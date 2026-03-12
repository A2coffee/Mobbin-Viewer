import { LIGHTBOX_ID, STATUS_OVERLAY_ID } from '../shared/constants';
import iconLoadingSvg from '../shared/icons/icon_loading.svg?raw';
import iconZipDownloadingSvg from '../shared/icons/icon_zip_downloading.svg?raw';
import iconZipFailedSvg from '../shared/icons/icon_zip_failed.svg?raw';
import iconZipNetworkErrorSvg from '../shared/icons/icon_zip_network error.svg?raw';
import iconZipSuccessfulSvg from '../shared/icons/icon_zip_successful.svg?raw';
import iconZipSvg from '../shared/icons/icon_zip.svg?raw';
import type { DownloadStatusVariant } from '../shared/download-status';
import { getDownloadUrlForMedia } from './media-url-normalizer';

const CONTROL_SELECTOR = '.mobbin-viewer-controls';

export type DownloadToastVariant = DownloadStatusVariant;

export type DownloadToastAction = {
  label: string;
  level: 'lv1' | 'lv2';
  onClick(): void;
};

export type DownloadToastState = {
  variant: DownloadToastVariant;
  filename?: string;
  detail: string;
  actions?: DownloadToastAction[];
  autoDismissMs?: number;
};

export type DownloadToastHandle = {
  render(state: DownloadToastState): void;
  remove(): void;
};

const toastIconMap: Record<DownloadToastVariant, string> = {
  scrolling: iconLoadingSvg,
  downloading: iconZipDownloadingSvg,
  retrying: iconZipDownloadingSvg,
  packaging: iconZipSvg,
  success: iconZipSuccessfulSvg,
  download_failed: iconZipFailedSvg,
  partial_failed: iconZipFailedSvg,
  network_error: iconZipNetworkErrorSvg,
};

function createInlineIcon(markup: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" preserveAspectRatio="xMidYMid meet" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
}

function createControlButton(label: string, icon: string, iconOnly = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mobbin-viewer-button${iconOnly ? ' mobbin-viewer-button--icon' : ''}`;
  button.innerHTML = iconOnly ? icon : `${icon}<span>${label}</span>`;
  button.title = label;
  button.setAttribute('aria-label', label);
  return button;
}

function createToastButton(action: DownloadToastAction): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mobbin-viewer-toast-button mobbin-viewer-toast-button--${action.level}`;
  button.textContent = action.label;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    action.onClick();
  });
  return button;
}

function createStatusIcon(svgMarkup: string): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'mobbin-viewer-download-toast-icon';
  icon.innerHTML = svgMarkup;
  return icon;
}

async function downloadMedia(media: HTMLImageElement | HTMLVideoElement): Promise<void> {
  const url = getDownloadUrlForMedia(media);

  if (!url) {
    throw new Error('没有可下载的资源地址。');
  }

  const extension = media instanceof HTMLVideoElement ? 'mp4' : 'png';
  const filename = `mobbin-${Date.now()}.${extension}`;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    const fallback = document.createElement('a');
    fallback.href = url;
    fallback.download = filename;
    fallback.target = '_blank';
    fallback.click();
  }
}

async function copyImage(image: HTMLImageElement, button: HTMLButtonElement): Promise<void> {
  const url = getDownloadUrlForMedia(image);

  if (!url) {
    throw new Error('没有可复制的图片地址。');
  }

  const previousLabel = button.innerHTML;
  button.innerHTML = '<span class="mobbin-viewer-status-spinner"></span><span>复制中</span>';

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    button.innerHTML = `${iconZipSuccessfulSvg}<span>已复制</span>`;
    window.setTimeout(() => {
      button.innerHTML = previousLabel;
    }, 1800);
  } catch (error) {
    button.innerHTML = previousLabel;
    throw error;
  }
}

function cleanupLightboxListeners(cleanups: Array<() => void>): void {
  cleanups.forEach((cleanup) => cleanup());
}

export function openLightbox(sourceUrl: string, kind: 'image' | 'video'): void {
  document.getElementById(LIGHTBOX_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = LIGHTBOX_ID;
  overlay.className = 'mobbin-viewer-lightbox';

  const closeButton = createControlButton(
    '关闭',
    createInlineIcon('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'),
    true,
  );
  closeButton.className = 'mobbin-viewer-lightbox-close';

  const spinner = document.createElement('div');
  spinner.className = 'mobbin-viewer-lightbox-spinner';
  spinner.innerHTML = '<span class="mobbin-viewer-status-spinner"></span>资源加载中...';

  let mediaElement: HTMLImageElement | HTMLVideoElement;

  if (kind === 'video') {
    const video = document.createElement('video');
    video.src = sourceUrl;
    video.controls = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.className = 'mobbin-viewer-lightbox-media';
    video.addEventListener('loadeddata', () => spinner.remove(), { once: true });
    mediaElement = video;
  } else {
    const image = document.createElement('img');
    image.src = sourceUrl;
    image.alt = 'Mobbin 预览图';
    image.className = 'mobbin-viewer-lightbox-media';
    image.addEventListener('load', () => spinner.remove(), { once: true });
    mediaElement = image;
  }

  const cleanups: Array<() => void> = [];
  const close = (): void => {
    overlay.classList.remove('is-visible');
    cleanupLightboxListeners(cleanups);
    window.setTimeout(() => overlay.remove(), 180);
  };

  closeButton.addEventListener('click', close);

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close();
    }
  };

  document.addEventListener('keydown', handleKeydown);
  cleanups.push(() => document.removeEventListener('keydown', handleKeydown));

  let dragStartX = 0;
  let dragStartY = 0;
  let translateX = 0;
  let translateY = 0;
  let lastX = 0;
  let lastY = 0;
  let scale = 1;
  let dragging = false;

  const updateTransform = (): void => {
    mediaElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };

  if (mediaElement instanceof HTMLImageElement) {
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      scale = Math.min(10, Math.max(0.5, scale * (event.deltaY > 0 ? 0.92 : 1.08)));
      updateTransform();
    };

    const onMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }

      dragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      lastX = translateX;
      lastY = translateY;
      mediaElement.style.cursor = 'grabbing';
    };

    const onMouseMove = (event: MouseEvent): void => {
      if (!dragging) {
        return;
      }

      translateX = lastX + (event.clientX - dragStartX);
      translateY = lastY + (event.clientY - dragStartY);
      updateTransform();
    };

    const onMouseUp = (): void => {
      dragging = false;
      mediaElement.style.cursor = 'grab';
    };

    overlay.addEventListener('wheel', onWheel, { passive: false });
    mediaElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    cleanups.push(() => overlay.removeEventListener('wheel', onWheel));
    cleanups.push(() => mediaElement.removeEventListener('mousedown', onMouseDown));
    cleanups.push(() => window.removeEventListener('mousemove', onMouseMove));
    cleanups.push(() => window.removeEventListener('mouseup', onMouseUp));
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  overlay.append(closeButton, spinner, mediaElement);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}

export function ensureMediaControls(
  container: HTMLElement,
  media: HTMLImageElement | HTMLVideoElement,
): void {
  if (container.querySelector(CONTROL_SELECTOR)) {
    return;
  }

  const root = document.createElement('div');
  root.className = 'mobbin-viewer-controls';

  const topActions = document.createElement('div');
  topActions.className = 'mobbin-viewer-top-actions';
  const bottomActions = document.createElement('div');
  bottomActions.className = 'mobbin-viewer-bottom-actions';

  const fullscreenButton = createControlButton(
    '全屏查看',
    createInlineIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>'),
    true,
  );

  const downloadButton = createControlButton(
    '下载',
    createInlineIcon('<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>'),
  );

  fullscreenButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const url = getDownloadUrlForMedia(media);
    if (url) {
      openLightbox(url, media instanceof HTMLVideoElement ? 'video' : 'image');
    }
  });

  downloadButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadButton.disabled = true;

    try {
      await downloadMedia(media);
    } catch (error) {
      alert(error instanceof Error ? `下载失败：${error.message}` : '下载失败。');
    } finally {
      downloadButton.disabled = false;
    }
  });

  topActions.appendChild(fullscreenButton);
  bottomActions.appendChild(downloadButton);

  if (media instanceof HTMLImageElement) {
    const copyButton = createControlButton(
      '复制',
      createInlineIcon('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'),
    );

    copyButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await copyImage(media, copyButton);
      } catch (error) {
        alert(error instanceof Error ? `复制失败：${error.message}` : '复制失败。');
      }
    });

    bottomActions.appendChild(copyButton);
  } else {
    downloadButton.classList.add('mobbin-viewer-button--single');
  }

  root.append(topActions, bottomActions);
  container.appendChild(root);
}

export function createDownloadToast(): DownloadToastHandle {
  document.getElementById(STATUS_OVERLAY_ID)?.remove();

  const region = document.createElement('div');
  region.id = STATUS_OVERLAY_ID;
  region.className = 'mobbin-viewer-download-toast-region';

  const card = document.createElement('div');
  card.className = 'mobbin-viewer-download-toast';

  region.appendChild(card);
  document.body.appendChild(region);

  let dismissTimer: number | null = null;

  const clearDismissTimer = (): void => {
    if (dismissTimer !== null) {
      window.clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  return {
    render(state) {
      clearDismissTimer();
      region.dataset.variant = state.variant;

      const content = document.createElement('div');
      content.className = 'mobbin-viewer-download-toast-content';

      const icon = createStatusIcon(toastIconMap[state.variant]);

      const copy = document.createElement('div');
      copy.className = 'mobbin-viewer-download-toast-copy';

      const title = document.createElement('p');
      title.className = 'mobbin-viewer-download-toast-title';
      title.textContent = state.filename ?? 'mobbin_screens.zip';

      const detail = document.createElement('p');
      detail.className = 'mobbin-viewer-download-toast-detail';
      detail.textContent = state.detail;

      copy.append(title, detail);
      content.append(icon, copy);

      if (state.actions?.length) {
        const actions = document.createElement('div');
        actions.className = 'mobbin-viewer-download-toast-actions';
        state.actions.forEach((action) => actions.appendChild(createToastButton(action)));
        content.appendChild(actions);
      }

      card.replaceChildren(content);

      if (state.autoDismissMs) {
        dismissTimer = window.setTimeout(() => {
          region.remove();
        }, state.autoDismissMs);
      }
    },
    remove() {
      clearDismissTimer();
      region.remove();
    },
  };
}

export function removeInjectedUi(): void {
  document.querySelectorAll(CONTROL_SELECTOR).forEach((node) => node.remove());
  document.getElementById(LIGHTBOX_ID)?.remove();
  document.getElementById(STATUS_OVERLAY_ID)?.remove();
}
