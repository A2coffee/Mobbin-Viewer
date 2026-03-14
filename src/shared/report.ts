export type DownloadFailureKind =
  | 'network'
  | 'timeout'
  | 'http_400'
  | 'http_403'
  | 'http_404'
  | 'http_429'
  | 'http_5xx'
  | 'http_other'
  | 'unknown'
  | 'empty'
  | 'missing_after_rescan';

export type DownloadReportAssetStatus =
  | 'success'
  | 'recovered'
  | 'failed'
  | 'missing_after_rescan'
  | 'empty';

export type DownloadAttemptRecord = {
  phase: 'initial' | 'retry';
  attemptInPhase: number;
  startedAt: string;
  durationMs: number;
  url: string;
  outcome: 'success' | 'failure';
  failureKind?: DownloadFailureKind;
  httpStatus?: number;
  message?: string;
};

export type DownloadReportAsset = {
  assetId: string;
  filename: string;
  kind: 'image' | 'video';
  sourcePath: string;
  occurrence: number;
  initialUrl: string;
  latestUrl: string | null;
  querySignature?: string;
  hasWatermarkParam?: boolean;
  hasVersionParam?: boolean;
  finalStatus: DownloadReportAssetStatus;
  finalFailureKind?: DownloadFailureKind;
  finalErrorMessage?: string;
  httpStatus?: number;
  attempts: DownloadAttemptRecord[];
};

export type DownloadReport = {
  runId: string;
  extensionVersion: string;
  pageUrl: string;
  startedAt: string;
  finishedAt: string;
  initialAssetCount: number;
  successfulCount: number;
  failedCount: number;
  rescanCount: number;
  hasFailures: boolean;
  summary: {
    statusCounts: Partial<Record<DownloadReportAssetStatus, number>>;
    failureKindCounts: Partial<Record<DownloadFailureKind, number>>;
  };
  assets: DownloadReportAsset[];
};
