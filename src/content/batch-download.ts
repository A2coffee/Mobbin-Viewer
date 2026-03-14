import JSZip from 'jszip';

import {
  DOWNLOAD_REPORT_FILENAME,
  DOWNLOAD_STATUS_FILENAME,
  HEADER_BUTTON_ID,
} from '../shared/constants';
import {
  buildDownloadStatusActions,
  type DownloadStatusActionId,
  type DownloadStatusSnapshot,
} from '../shared/download-status';
import { runtimeActions, type RuntimeResponse } from '../shared/messages';
import type {
  DownloadAttemptRecord,
  DownloadFailureKind,
  DownloadReport,
  DownloadReportAsset,
  DownloadReportAssetStatus,
} from '../shared/report';
import {
  convertPosterToVideoSrc,
  getDownloadUrlForMedia,
  isMobbinScreenImage,
  isMobbinVideoPoster,
  isMobbinVideoSource,
  normalizeDownloadImageUrl,
} from './media-url-normalizer';
import {
  createDownloadToast,
  type DownloadToastAction,
  type DownloadToastHandle,
  type DownloadToastState,
  type DownloadToastVariant,
} from './overlay-ui';

type BatchAssetKind = 'image' | 'video';
type DownloadRunMode = 'initial' | 'retry';

type BatchAsset = {
  assetId: string;
  url: string;
  kind: BatchAssetKind;
  filename: string;
  sourcePath: string;
  occurrence: number;
};

type BatchAssetFailure = {
  asset: BatchAsset;
  kind: DownloadFailureKind;
  message: string;
  attempts: number;
  httpStatus?: number;
};

type DownloadOutcomeContext = {
  mode: DownloadRunMode;
  previousFailureCount: number;
};

type DownloadReportSession = {
  runId: string;
  startedAt: number;
  initialAssetCount: number;
  rescanCount: number;
  hadFailures: boolean;
  assets: Map<string, DownloadReportAsset>;
};

const INITIAL_CONCURRENCY = 4;
const RETRY_CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS_PER_PHASE = 2;
const RETRY_BACKOFF_MS = [600, 1_800] as const;

class AssetDownloadError extends Error {
  readonly kind: DownloadFailureKind;

  readonly httpStatus?: number;

  constructor(message: string, kind: DownloadFailureKind, httpStatus?: number) {
    super(message);
    this.name = 'AssetDownloadError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toFilename(index: number, kind: BatchAssetKind): string {
  const padded = String(index + 1).padStart(3, '0');
  return `screen_${padded}.${kind === 'video' ? 'mp4' : 'png'}`;
}

function getJitterMs(): number {
  return Math.floor(Math.random() * 250);
}

function toSourcePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function getRetryDelayMs(attemptIndex: number): number {
  return RETRY_BACKOFF_MS[Math.min(attemptIndex, RETRY_BACKOFF_MS.length - 1)] + getJitterMs();
}

function normalizeHttpFailureKind(status: number): DownloadFailureKind {
  if (status === 400) {
    return 'http_400';
  }

  if (status === 403) {
    return 'http_403';
  }

  if (status === 404) {
    return 'http_404';
  }

  if (status === 429) {
    return 'http_429';
  }

  if (status >= 500) {
    return 'http_5xx';
  }

  return 'http_other';
}

function isRecoverableFailureKind(kind: DownloadFailureKind): boolean {
  return kind === 'network' || kind === 'timeout' || kind === 'http_429' || kind === 'http_5xx';
}

function isNetworkCategory(kind: DownloadFailureKind): boolean {
  return (
    kind === 'network' || kind === 'timeout' || kind === 'http_429' || kind === 'http_5xx'
  );
}

function getMaxAttempt(failures: BatchAssetFailure[]): number {
  return failures.reduce((max, failure) => Math.max(max, failure.attempts), 1);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let currentIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (currentIndex < items.length) {
        const index = currentIndex;
        currentIndex += 1;
        await task(items[index], index);
      }
    }),
  );
}

function createFailureMessage(kind: DownloadFailureKind, httpStatus?: number): string {
  switch (kind) {
    case 'timeout':
      return '请求超时';
    case 'network':
      return '网络异常';
    case 'http_400':
      return 'HTTP 400: invalid image transform parameters';
    case 'http_403':
      return 'HTTP 403';
    case 'http_404':
      return 'HTTP 404';
    case 'http_429':
      return 'HTTP 429';
    case 'http_5xx':
      return httpStatus ? `HTTP ${httpStatus}` : 'HTTP 5xx';
    case 'http_other':
      return httpStatus ? `HTTP ${httpStatus}` : 'HTTP 异常';
    case 'missing_after_rescan':
      return '刷新后未找到对应资源';
    case 'empty':
      return '未发现可下载资源';
    default:
      return '未知下载失败';
  }
}

function buildQuerySignature(url: string | null): {
  querySignature?: string;
  hasWatermarkParam?: boolean;
  hasVersionParam?: boolean;
} {
  if (!url) {
    return {};
  }

  try {
    const parsed = new URL(url);
    const format = parsed.searchParams.get('f') ?? '-';
    const width = parsed.searchParams.get('w') ?? '-';
    const quality = parsed.searchParams.get('q') ?? '-';
    const gravity = parsed.searchParams.get('gravity') ?? '-';
    const hasWatermarkParam = parsed.searchParams.has('image');
    const hasVersionParam = parsed.searchParams.has('v');

    return {
      querySignature: `f=${format}|w=${width}|q=${quality}|gravity=${gravity}|image=${hasWatermarkParam ? '1' : '0'}|v=${hasVersionParam ? '1' : '0'}`,
      hasWatermarkParam,
      hasVersionParam,
    };
  } catch {
    return {};
  }
}

export class BatchDownloadManager {
  private readonly onRescan: () => void;

  private isDownloading = false;

  private hiddenMoreButton: HTMLElement | null = null;

  private toast: DownloadToastHandle | null = null;

  private stateClearTimer: number | null = null;

  private activeAssets: BatchAsset[] = [];

  private successfulAssets = new Map<string, Blob>();

  private failedAssets: BatchAssetFailure[] = [];

  private reportSession: DownloadReportSession | null = null;

  constructor(onRescan: () => void) {
    this.onRescan = onRescan;
  }

  ensureHeaderButton(): void {
    if (!this.isScreenPage() || document.getElementById(HEADER_BUTTON_ID)) {
      return;
    }

    const buttons = Array.from(document.querySelectorAll('button'));
    const rateButton = buttons.find((button) => button.textContent?.trim() === 'Rate');

    if (!rateButton?.parentElement) {
      return;
    }

    const container = rateButton.parentElement;
    const button = document.createElement('button');
    button.id = HEADER_BUTTON_ID;
    button.type = 'button';
    button.className = rateButton.className;
    button.style.width = '160px';
    button.style.height = '44px';
    button.textContent = '打包下载';
    button.title = '批量下载当前页面全部素材';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.start();
    });

    const moreButton = Array.from(container.children).find(
      (element) =>
        element instanceof HTMLButtonElement && element !== rateButton && element.querySelector('svg'),
    );

    if (moreButton instanceof HTMLElement) {
      this.hiddenMoreButton = moreButton;
      moreButton.style.display = 'none';
      container.insertBefore(button, moreButton);
      return;
    }

    if (rateButton.nextSibling) {
      container.insertBefore(button, rateButton.nextSibling);
      return;
    }

    container.appendChild(button);
  }

  resetUi(): void {
    document.getElementById(HEADER_BUTTON_ID)?.remove();
    if (this.hiddenMoreButton) {
      this.hiddenMoreButton.style.display = '';
      this.hiddenMoreButton = null;
    }

    this.toast?.remove();
    this.toast = null;
    this.clearStateClearTimer();
    this.isDownloading = false;
    this.activeAssets = [];
    this.successfulAssets = new Map();
    this.failedAssets = [];
    this.reportSession = null;
    this.clearDownloadState();
  }

  async performAction(actionId: DownloadStatusActionId): Promise<void> {
    switch (actionId) {
      case 'retry':
        if (this.isDownloading) {
          return;
        }

        if (this.failedAssets.some((failure) => failure.kind === 'empty')) {
          await this.start();
          return;
        }

        if (this.failedAssets.length === 0) {
          return;
        }

        await this.retryFailedAssets(
          this.activeAssets,
          new Map(this.successfulAssets),
          this.failedAssets,
          new Map(this.failedAssets.map((failure) => [failure.asset.assetId, failure.attempts])),
        );
        return;
      case 'keep':
        if (this.isDownloading || this.successfulAssets.size === 0) {
          return;
        }

        await this.packageRetainedAssets(
          this.activeAssets,
          new Map(this.successfulAssets),
          this.failedAssets.length,
        );
        return;
      case 'open_downloads_folder':
        await this.openDownloadsFolder(this.successfulAssets.size, this.failedAssets.length);
        return;
      default:
        return;
    }
  }

  private isScreenPage(): boolean {
    return window.location.href.includes('/screens');
  }

  private ensureToast(): DownloadToastHandle {
    if (!this.toast) {
      this.toast = createDownloadToast();
    }

    return this.toast;
  }

  private clearStateClearTimer(): void {
    if (this.stateClearTimer !== null) {
      window.clearTimeout(this.stateClearTimer);
      this.stateClearTimer = null;
    }
  }

  private clearDownloadState(): void {
    this.clearStateClearTimer();
    void this.clearPublishedDownloadState();
  }

  private setDownloadContext(
    allAssets: BatchAsset[],
    successes: Map<string, Blob>,
    failures: BatchAssetFailure[],
  ): void {
    this.activeAssets = [...allAssets];
    this.successfulAssets = new Map(successes);
    this.failedAssets = [...failures];
  }

  private toToastActions(actionIds: DownloadStatusActionId[]): DownloadToastAction[] {
    return buildDownloadStatusActions(actionIds).map((action) => ({
      label: action.label,
      level: action.level,
      onClick: () => {
        void this.performAction(action.id);
      },
    }));
  }

  private async publishDownloadState(snapshot: DownloadStatusSnapshot): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: runtimeActions.syncDownloadState,
        snapshot,
      });
    } catch {
      // ignore state sync failures so page-side download flow can continue
    }
  }

  private async clearPublishedDownloadState(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: runtimeActions.clearDownloadState,
      });
    } catch {
      // ignore cleanup failures
    }
  }

  private renderState(
    variant: DownloadToastVariant,
    detail: string,
    actionIds: DownloadStatusActionId[] = [],
    autoDismissMs?: number,
  ): void {
    this.clearStateClearTimer();

    const actions = this.toToastActions(actionIds);
    const state: DownloadToastState = {
      variant,
      filename: DOWNLOAD_STATUS_FILENAME,
      detail,
      actions: actions.length > 0 ? actions : undefined,
      autoDismissMs,
    };

    this.ensureToast().render(state);

    void this.publishDownloadState({
      variant,
      filename: DOWNLOAD_STATUS_FILENAME,
      detail,
      actions: buildDownloadStatusActions(actionIds),
      updatedAt: Date.now(),
    });

    if (autoDismissMs) {
      this.stateClearTimer = window.setTimeout(() => {
        this.stateClearTimer = null;
        void this.clearPublishedDownloadState();
      }, autoDismissMs);
    }
  }

  private collectAssets(): BatchAsset[] {
    const items: BatchAsset[] = [];
    const seenUrls = new Set<string>();
    const occurrenceByPath = new Map<string, number>();

    const pushAsset = (url: string, kind: BatchAssetKind): void => {
      if (!url || seenUrls.has(url)) {
        return;
      }

      seenUrls.add(url);
      const sourcePath = toSourcePath(url);
      const identityPrefix = `${kind}:${sourcePath}`;
      const occurrence = (occurrenceByPath.get(identityPrefix) ?? 0) + 1;
      occurrenceByPath.set(identityPrefix, occurrence);

      items.push({
        assetId: `${identityPrefix}#${occurrence}`,
        url,
        kind,
        filename: '',
        sourcePath,
        occurrence,
      });
    };

    document.querySelectorAll('img').forEach((node) => {
      const image = node as HTMLImageElement;
      const source = image.currentSrc || image.src;

      if (!isMobbinScreenImage(source)) {
        return;
      }

      pushAsset(normalizeDownloadImageUrl(source), 'image');
    });

    document.querySelectorAll('video').forEach((node) => {
      const video = node as HTMLVideoElement;
      const source = video.currentSrc || video.src;
      const poster = video.getAttribute('poster');

      let url: string | null = null;
      if (source && isMobbinVideoSource(source)) {
        url = source;
      } else if (poster && isMobbinVideoPoster(poster)) {
        url = convertPosterToVideoSrc(poster);
      } else {
        url = getDownloadUrlForMedia(video);
      }

      if (url) {
        pushAsset(url, 'video');
      }
    });

    return items.map((asset, index) => ({
      ...asset,
      filename: toFilename(index, asset.kind),
    }));
  }

  private async scrollToBottom(message = '正在滚动加载更多内容...'): Promise<void> {
    let lastHeight = document.body.scrollHeight;
    let noChangeCount = 0;

    while (noChangeCount < 3) {
      window.scrollTo(0, document.body.scrollHeight);
      this.renderState('scrolling', `${message} 当前高度 ${document.body.scrollHeight}px`);
      await wait(1_200);
      this.onRescan();

      const nextHeight = document.body.scrollHeight;
      if (nextHeight === lastHeight) {
        noChangeCount += 1;
      } else {
        noChangeCount = 0;
        lastHeight = nextHeight;
      }
    }
  }

  private initializeReportSession(assets: BatchAsset[]): void {
    const assetsById = new Map<string, DownloadReportAsset>();

    assets.forEach((asset) => {
      const queryDiagnostics = buildQuerySignature(asset.url);
      assetsById.set(asset.assetId, {
        assetId: asset.assetId,
        filename: asset.filename,
        kind: asset.kind,
        sourcePath: asset.sourcePath,
        occurrence: asset.occurrence,
        initialUrl: asset.url,
        latestUrl: asset.url,
        ...queryDiagnostics,
        finalStatus: 'success',
        attempts: [],
      });
    });

    this.reportSession = {
      runId: createRunId(),
      startedAt: Date.now(),
      initialAssetCount: assets.length,
      rescanCount: 0,
      hadFailures: false,
      assets: assetsById,
    };
  }

  private ensureReportEntry(asset: BatchAsset): DownloadReportAsset {
    if (!this.reportSession) {
      this.initializeReportSession(this.activeAssets);
    }

    const session = this.reportSession!;
    const existing = session.assets.get(asset.assetId);
    if (existing) {
      existing.latestUrl = asset.url;
      existing.filename = asset.filename;
      Object.assign(existing, buildQuerySignature(asset.url));
      return existing;
    }

    const queryDiagnostics = buildQuerySignature(asset.url);
    const created: DownloadReportAsset = {
      assetId: asset.assetId,
      filename: asset.filename,
      kind: asset.kind,
      sourcePath: asset.sourcePath,
      occurrence: asset.occurrence,
      initialUrl: asset.url,
      latestUrl: asset.url,
      ...queryDiagnostics,
      finalStatus: 'success',
      attempts: [],
    };
    session.assets.set(asset.assetId, created);
    return created;
  }

  private recordAttempt(
    asset: BatchAsset,
    phase: DownloadRunMode,
    attemptInPhase: number,
    url: string,
    startedAt: number,
    outcome: 'success' | 'failure',
    error?: AssetDownloadError,
  ): void {
    const entry = this.ensureReportEntry(asset);
    const attempt: DownloadAttemptRecord = {
      phase,
      attemptInPhase,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      url,
      outcome,
      failureKind: error?.kind,
      httpStatus: error?.httpStatus,
      message: error?.message,
    };

    entry.attempts.push(attempt);
    entry.latestUrl = url;
    Object.assign(entry, buildQuerySignature(url));

    if (outcome === 'success') {
      const hadFailure = entry.attempts.some((item) => item.outcome === 'failure');
      entry.finalStatus = phase === 'retry' && hadFailure ? 'recovered' : 'success';
      entry.finalFailureKind = undefined;
      entry.finalErrorMessage = undefined;
      entry.httpStatus = undefined;
      return;
    }

    if (this.reportSession) {
      this.reportSession.hadFailures = true;
    }

    entry.finalStatus = error?.kind === 'missing_after_rescan' ? 'missing_after_rescan' : 'failed';
    entry.finalFailureKind = error?.kind;
    entry.finalErrorMessage = error?.message;
    entry.httpStatus = error?.httpStatus;
  }

  private createEmptyFailure(): BatchAssetFailure {
    const asset: BatchAsset = {
      assetId: 'empty:page#1',
      filename: DOWNLOAD_STATUS_FILENAME,
      kind: 'image',
      url: window.location.href,
      sourcePath: window.location.pathname,
      occurrence: 1,
    };

    const entry = this.ensureReportEntry(asset);
    if (this.reportSession) {
      this.reportSession.hadFailures = true;
    }

    entry.finalStatus = 'empty';
    entry.finalFailureKind = 'empty';
    entry.finalErrorMessage = createFailureMessage('empty');
    entry.latestUrl = asset.url;

    return {
      asset,
      kind: 'empty',
      message: createFailureMessage('empty'),
      attempts: 1,
    };
  }

  private async fetchAsset(asset: BatchAsset): Promise<Blob> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(asset.url, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        const failureKind = normalizeHttpFailureKind(response.status);
        throw new AssetDownloadError(
          createFailureMessage(failureKind, response.status),
          failureKind,
          response.status,
        );
      }

      return response.blob();
    } catch (error) {
      if (error instanceof AssetDownloadError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AssetDownloadError(createFailureMessage('timeout'), 'timeout');
      }

      if (error instanceof Error) {
        throw new AssetDownloadError(error.message || createFailureMessage('network'), 'network');
      }

      throw new AssetDownloadError(createFailureMessage('unknown'), 'unknown');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private getAttemptNumber(
    assets: BatchAsset[],
    previousAttempts: Map<string, number>,
  ): number {
    return (
      assets.reduce((max, asset) => Math.max(max, previousAttempts.get(asset.assetId) ?? 0), 0) + 1
    );
  }

  private async downloadSingleAsset(asset: BatchAsset, mode: DownloadRunMode): Promise<Blob> {
    let lastError: AssetDownloadError | null = null;

    for (let attemptInPhase = 1; attemptInPhase <= MAX_ATTEMPTS_PER_PHASE; attemptInPhase += 1) {
      const startedAt = Date.now();

      try {
        const blob = await this.fetchAsset(asset);
        this.recordAttempt(asset, mode, attemptInPhase, asset.url, startedAt, 'success');
        return blob;
      } catch (error) {
        const normalized =
          error instanceof AssetDownloadError
            ? error
            : new AssetDownloadError(createFailureMessage('unknown'), 'unknown');
        lastError = normalized;
        this.recordAttempt(asset, mode, attemptInPhase, asset.url, startedAt, 'failure', normalized);

        if (
          attemptInPhase >= MAX_ATTEMPTS_PER_PHASE
          || !isRecoverableFailureKind(normalized.kind)
        ) {
          break;
        }

        await wait(getRetryDelayMs(attemptInPhase - 1));
      }
    }

    throw lastError ?? new AssetDownloadError(createFailureMessage('unknown'), 'unknown');
  }

  private async downloadAssets(
    assets: BatchAsset[],
    existingSuccesses: Map<string, Blob>,
    previousAttempts: Map<string, number>,
    mode: DownloadRunMode,
  ): Promise<{ successes: Map<string, Blob>; failures: BatchAssetFailure[] }> {
    const successes = new Map(existingSuccesses);
    const failures: BatchAssetFailure[] = [];
    let startedCount = 0;
    const attemptNumber = this.getAttemptNumber(assets, previousAttempts);
    const concurrency = mode === 'retry' ? RETRY_CONCURRENCY : INITIAL_CONCURRENCY;

    await runWithConcurrency(assets, concurrency, async (asset) => {
      startedCount += 1;

      if (mode === 'retry') {
        this.renderState(
          'retrying',
          `正在刷新后重试失败项 ${startedCount} / ${assets.length} · 第 ${attemptNumber} 次尝试`,
        );
      } else {
        this.renderState('downloading', `正在下载 ${startedCount} / ${assets.length}：${asset.filename}`);
      }

      try {
        const blob = await this.downloadSingleAsset(asset, mode);
        successes.set(asset.filename, blob);
      } catch (error) {
        const normalized =
          error instanceof AssetDownloadError
            ? error
            : new AssetDownloadError(createFailureMessage('unknown'), 'unknown');
        failures.push({
          asset,
          kind: normalized.kind,
          message: normalized.message,
          attempts: (previousAttempts.get(asset.assetId) ?? 0) + 1,
          httpStatus: normalized.httpStatus,
        });
      }
    });

    return { successes, failures };
  }

  private shouldIncludeReportInZip(): boolean {
    return Boolean(this.reportSession?.hadFailures);
  }

  private buildReport(successCount: number): DownloadReport | null {
    if (!this.reportSession) {
      return null;
    }

    const assets = Array.from(this.reportSession.assets.values()).sort((left, right) =>
      left.filename.localeCompare(right.filename),
    );
    const statusCounts: Partial<Record<DownloadReportAssetStatus, number>> = {};
    const failureKindCounts: Partial<Record<DownloadFailureKind, number>> = {};

    assets.forEach((asset) => {
      statusCounts[asset.finalStatus] = (statusCounts[asset.finalStatus] ?? 0) + 1;
      if (asset.finalFailureKind) {
        failureKindCounts[asset.finalFailureKind] = (failureKindCounts[asset.finalFailureKind] ?? 0) + 1;
      }
    });

    return {
      runId: this.reportSession.runId,
      extensionVersion: chrome.runtime.getManifest().version,
      pageUrl: window.location.href,
      startedAt: new Date(this.reportSession.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      initialAssetCount: this.reportSession.initialAssetCount,
      successfulCount: successCount,
      failedCount: assets.length - successCount,
      rescanCount: this.reportSession.rescanCount,
      hasFailures: this.reportSession.hadFailures,
      summary: {
        statusCounts,
        failureKindCounts,
      },
      assets,
    };
  }

  private createReportBlob(successCount: number): Blob | null {
    const report = this.buildReport(successCount);
    if (!report) {
      return null;
    }

    return new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  }

  private triggerFileDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }

  private triggerFailureReportDownload(successCount: number): void {
    const reportBlob = this.createReportBlob(successCount);
    if (reportBlob) {
      this.triggerFileDownload(reportBlob, DOWNLOAD_REPORT_FILENAME);
    }
  }

  private async createZipBlob(allAssets: BatchAsset[], successes: Map<string, Blob>): Promise<Blob> {
    const zip = new JSZip();

    for (const asset of allAssets) {
      const blob = successes.get(asset.filename);
      if (blob) {
        zip.file(asset.filename, blob);
      }
    }

    if (this.shouldIncludeReportInZip()) {
      const reportBlob = this.createReportBlob(successes.size);
      if (reportBlob) {
        zip.file(DOWNLOAD_REPORT_FILENAME, reportBlob);
      }
    }

    return zip.generateAsync({ type: 'blob' });
  }

  private async packageSuccesses(
    allAssets: BatchAsset[],
    successes: Map<string, Blob>,
    skippedCount = 0,
  ): Promise<void> {
    this.setDownloadContext(allAssets, successes, []);
    this.renderState('packaging', '正在生成 ZIP 压缩包');

    const blob = await this.createZipBlob(allAssets, successes);
    this.triggerFileDownload(blob, DOWNLOAD_STATUS_FILENAME);
    this.isDownloading = false;
    this.renderSuccess(successes.size, skippedCount);
  }

  private renderSuccess(successCount: number, skippedCount = 0, message?: string): void {
    const hasReport = this.shouldIncludeReportInZip();
    const detail =
      message
      ?? (skippedCount > 0
        ? `下载完成，成功 ${successCount} 个，跳过 ${skippedCount} 个${hasReport ? '，失败报告已包含在 ZIP 中' : ''}`
        : `下载完成，成功 ${successCount} 个${hasReport ? '，失败报告已包含在 ZIP 中' : ''}`);

    this.renderState('success', detail, ['open_downloads_folder'], 5_000);
  }

  private async openDownloadsFolder(successCount: number, skippedCount: number): Promise<void> {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: runtimeActions.openDownloadsFolder,
      })) as RuntimeResponse | undefined;

      if (!response?.ok) {
        throw new Error(response?.error ?? '无法打开默认下载目录');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法打开默认下载目录';
      this.renderSuccess(
        successCount,
        skippedCount,
        `下载完成，成功 ${successCount} 个，打开目录失败：${message}`,
      );
    }
  }

  private renderTotalFailure(
    allAssets: BatchAsset[],
    failures: BatchAssetFailure[],
    context: DownloadOutcomeContext,
  ): void {
    this.isDownloading = false;
    this.setDownloadContext(allAssets, new Map(), failures);
    this.triggerFailureReportDownload(0);

    const allNetworkFailures = failures.every((failure) => isNetworkCategory(failure.kind));
    const hasEmptyFailure = failures.some((failure) => failure.kind === 'empty');
    const attemptNumber = getMaxAttempt(failures);
    const variant: DownloadToastVariant = allNetworkFailures ? 'network_error' : 'download_failed';

    let detail: string;
    if (allNetworkFailures) {
      detail =
        context.mode === 'retry'
          ? `刷新后重试仍全部失败 · 第 ${attemptNumber} 次尝试，已导出失败报告`
          : '网络异常，无法下载，已导出失败报告';
    } else if (hasEmptyFailure) {
      detail = '未发现可下载资源，已导出失败报告';
    } else {
      detail =
        context.mode === 'retry'
          ? `刷新后重试仍全部失败 · 第 ${attemptNumber} 次尝试，已导出失败报告`
          : `下载失败，失败 ${failures.length} 个，已导出失败报告`;
    }

    this.renderState(variant, detail, ['retry']);
  }

  private renderPartialFailure(
    allAssets: BatchAsset[],
    successes: Map<string, Blob>,
    failures: BatchAssetFailure[],
    context: DownloadOutcomeContext,
  ): void {
    this.isDownloading = false;
    this.setDownloadContext(allAssets, successes, failures);

    const attemptNumber = getMaxAttempt(failures);
    const recoveredCount = Math.max(0, context.previousFailureCount - failures.length);

    let detail = `部分下载失败，当前成功 ${successes.size} 个，失败 ${failures.length} 个`;
    if (context.mode === 'retry') {
      detail =
        recoveredCount > 0
          ? `刷新后重试恢复 ${recoveredCount} 个，当前成功 ${successes.size} 个，失败 ${failures.length} 个 · 第 ${attemptNumber} 次尝试`
          : `刷新后重试未恢复失败项，当前成功 ${successes.size} 个，失败 ${failures.length} 个 · 第 ${attemptNumber} 次尝试`;
    }

    detail += '，保留下载时会把失败报告一并写入 ZIP';
    this.renderState('partial_failed', detail, ['keep', 'retry']);
  }

  private async packageRetainedAssets(
    allAssets: BatchAsset[],
    successes: Map<string, Blob>,
    skippedCount: number,
  ): Promise<void> {
    this.isDownloading = true;

    try {
      await this.packageSuccesses(allAssets, successes, skippedCount);
    } catch (error) {
      this.isDownloading = false;
      this.setDownloadContext(allAssets, successes, this.failedAssets);
      this.renderState('download_failed', error instanceof Error ? error.message : '打包失败', ['keep']);
    }
  }

  private async refreshRetryAssets(failures: BatchAssetFailure[]): Promise<{
    retryAssets: BatchAsset[];
    unresolvedFailures: BatchAssetFailure[];
  }> {
    this.renderState('scrolling', '正在刷新页面素材列表以重试失败项');
    await this.scrollToBottom('正在刷新页面素材列表...');

    const refreshedAssets = this.collectAssets();
    const refreshedById = new Map(refreshedAssets.map((asset) => [asset.assetId, asset]));

    if (this.reportSession) {
      this.reportSession.rescanCount += 1;
      refreshedAssets.forEach((asset) => {
        const entry = this.reportSession?.assets.get(asset.assetId);
        if (entry) {
          entry.latestUrl = asset.url;
        }
      });
    }

    const retryAssets: BatchAsset[] = [];
    const unresolvedFailures: BatchAssetFailure[] = [];

    failures.forEach((failure) => {
      const refreshed = refreshedById.get(failure.asset.assetId);
      if (!refreshed) {
        const error = new AssetDownloadError(
          createFailureMessage('missing_after_rescan'),
          'missing_after_rescan',
        );
        this.recordAttempt(
          failure.asset,
          'retry',
          0,
          failure.asset.url,
          Date.now(),
          'failure',
          error,
        );
        unresolvedFailures.push({
          asset: failure.asset,
          kind: 'missing_after_rescan',
          message: error.message,
          attempts: failure.attempts + 1,
        });
        return;
      }

      retryAssets.push({
        ...refreshed,
        assetId: failure.asset.assetId,
        filename: failure.asset.filename,
      });
    });

    return { retryAssets, unresolvedFailures };
  }

  private async retryFailedAssets(
    allAssets: BatchAsset[],
    existingSuccesses: Map<string, Blob>,
    failures: BatchAssetFailure[],
    previousAttempts: Map<string, number>,
  ): Promise<void> {
    this.isDownloading = true;

    try {
      const nextAttempt = this.getAttemptNumber(
        failures.map((failure) => failure.asset),
        previousAttempts,
      );
      this.renderState('retrying', `正在准备刷新后重试 · 第 ${nextAttempt} 次尝试`);

      const { retryAssets, unresolvedFailures } = await this.refreshRetryAssets(failures);

      if (retryAssets.length === 0) {
        await this.resolveOutcome(allAssets, existingSuccesses, unresolvedFailures, {
          mode: 'retry',
          previousFailureCount: failures.length,
        });
        return;
      }

      const nextResult = await this.downloadAssets(
        retryAssets,
        existingSuccesses,
        previousAttempts,
        'retry',
      );

      await this.resolveOutcome(
        allAssets,
        nextResult.successes,
        [...unresolvedFailures, ...nextResult.failures],
        {
          mode: 'retry',
          previousFailureCount: failures.length,
        },
      );
    } catch (error) {
      this.isDownloading = false;
      this.setDownloadContext(allAssets, existingSuccesses, failures);
      this.renderState(
        'download_failed',
        error instanceof Error ? `重试失败：${error.message}` : '重试失败',
        ['retry'],
      );
    }
  }

  private async resolveOutcome(
    allAssets: BatchAsset[],
    successes: Map<string, Blob>,
    failures: BatchAssetFailure[],
    context: DownloadOutcomeContext,
  ): Promise<void> {
    if (failures.length === 0) {
      await this.packageSuccesses(allAssets, successes);
      return;
    }

    if (successes.size === 0) {
      this.renderTotalFailure(allAssets, failures, context);
      return;
    }

    this.renderPartialFailure(allAssets, successes, failures, context);
  }

  async start(): Promise<void> {
    if (this.isDownloading) {
      return;
    }

    this.isDownloading = true;
    this.toast?.remove();
    this.toast = createDownloadToast();
    this.activeAssets = [];
    this.successfulAssets = new Map();
    this.failedAssets = [];
    this.reportSession = null;

    try {
      this.renderState('scrolling', '准备扫描当前页面...');
      await this.scrollToBottom();
      const assets = this.collectAssets();
      this.activeAssets = assets;
      this.initializeReportSession(assets);

      if (assets.length === 0) {
        this.renderTotalFailure(
          [],
          [this.createEmptyFailure()],
          {
            mode: 'initial',
            previousFailureCount: 0,
          },
        );
        return;
      }

      const result = await this.downloadAssets(assets, new Map(), new Map(), 'initial');
      await this.resolveOutcome(assets, result.successes, result.failures, {
        mode: 'initial',
        previousFailureCount: result.failures.length,
      });
    } catch (error) {
      this.isDownloading = false;
      this.renderState(
        'download_failed',
        error instanceof Error ? `批量下载失败：${error.message}` : '批量下载失败',
        ['retry'],
      );
    } finally {
      if (!document.getElementById(HEADER_BUTTON_ID)) {
        this.isDownloading = false;
      }
    }
  }
}
