import { popupActions, type ContentResponse, type PopupToContentMessage } from '../shared/messages';
import { getEnabled, watchEnabled } from '../shared/storage';
import { BatchDownloadManager } from './batch-download';
import { scanDocument } from './dom-scanner';
import { removeInjectedUi } from './overlay-ui';
import {
  clearProcessingMarkers,
  ensureRuntimeStyles,
  hideStickyAside,
  removeRuntimeStyles,
} from './unblur-engine';

function throttle(callback: () => void, waitMs: number): () => void {
  let timeout: number | null = null;
  let lastRun = 0;

  return () => {
    const now = Date.now();
    const remaining = waitMs - (now - lastRun);

    if (remaining <= 0) {
      if (timeout !== null) {
        window.clearTimeout(timeout);
        timeout = null;
      }

      lastRun = now;
      callback();
      return;
    }

    if (timeout === null) {
      timeout = window.setTimeout(() => {
        timeout = null;
        lastRun = Date.now();
        callback();
      }, remaining);
    }
  };
}

class ContentController {
  private observer: MutationObserver | null = null;

  private enabled = false;

  private readonly batchManager = new BatchDownloadManager(() => this.runScan());

  private readonly unwatchEnabled = watchEnabled((enabled) => {
    if (enabled) {
      this.enable();
      return;
    }

    this.disable();
  });

  getState(): 'enabled' | 'disabled' {
    return this.enabled ? 'enabled' : 'disabled';
  }

  enable(): void {
    this.enabled = true;
    ensureRuntimeStyles();

    if (this.observer) {
      this.runScan();
      return;
    }

    this.runScan();

    const throttledScan = throttle(() => this.runScan(), 1200);
    this.observer = new MutationObserver(() => throttledScan());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  disable(): void {
    this.enabled = false;
    this.observer?.disconnect();
    this.observer = null;
    this.batchManager.resetUi();
    removeInjectedUi();
    removeRuntimeStyles();
    clearProcessingMarkers();
  }

  dispose(): void {
    this.disable();
    this.unwatchEnabled();
  }

  async performDownloadAction(actionId: Extract<PopupToContentMessage, { type: typeof popupActions.downloadAction }>['actionId']): Promise<void> {
    await this.batchManager.performAction(actionId);
  }

  private runScan(): void {
    hideStickyAside();
    scanDocument();
    this.batchManager.ensureHeaderButton();
  }
}

const controller = new ContentController();

chrome.runtime.onMessage.addListener((
  message: PopupToContentMessage,
  _sender,
  sendResponse: (response: ContentResponse) => void,
) => {
  void (async () => {
    try {
      switch (message.type) {
        case popupActions.enable:
          controller.enable();
          sendResponse({ ok: true, state: 'enabled' });
          return;
        case popupActions.disable:
          controller.disable();
          sendResponse({ ok: true, state: 'disabled' });
          return;
        case popupActions.ping:
          sendResponse({ ok: true, state: controller.getState() });
          return;
        case popupActions.downloadAction:
          await controller.performDownloadAction(message.actionId);
          sendResponse({ ok: true, state: controller.getState() });
          return;
        default:
          sendResponse({ ok: false, error: '未知命令。' });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '页面处理失败。',
      });
    }
  })();

  return true;
});

void (async () => {
  const enabled = await getEnabled();
  if (enabled) {
    controller.enable();
  }
})();

window.addEventListener('beforeunload', () => {
  controller.dispose();
});
