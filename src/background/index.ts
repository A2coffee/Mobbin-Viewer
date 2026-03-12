import { runtimeActions, type RuntimeMessage, type RuntimeResponse } from '../shared/messages';
import {
  clearDownloadStateForTab,
  getEnabled,
  setDownloadStateForTab,
} from '../shared/storage';

chrome.runtime.onInstalled.addListener(async () => {
  await getEnabled();
});

chrome.runtime.onStartup.addListener(async () => {
  await getEnabled();
});

chrome.runtime.onMessage.addListener((
  message: RuntimeMessage,
  sender,
  sendResponse: (response: RuntimeResponse) => void,
) => {
  void (async () => {
    try {
      switch (message?.type) {
        case runtimeActions.openDownloadsFolder:
          chrome.downloads.showDefaultFolder();
          sendResponse({ ok: true });
          return;
        case runtimeActions.syncDownloadState:
          if (!sender.tab?.id) {
            sendResponse({ ok: false, error: '无法识别当前标签页。' });
            return;
          }

          await setDownloadStateForTab(sender.tab.id, message.snapshot);
          sendResponse({ ok: true });
          return;
        case runtimeActions.clearDownloadState:
          if (sender.tab?.id) {
            await clearDownloadStateForTab(sender.tab.id);
          }

          sendResponse({ ok: true });
          return;
        default:
          sendResponse({ ok: false, error: '未知后台命令。' });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '后台处理失败。',
      });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearDownloadStateForTab(tabId);
});
