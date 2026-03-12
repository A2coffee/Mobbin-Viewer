import iconLoadingSvg from '../shared/icons/icon_loading.svg?raw';
import iconOffSvg from '../shared/icons/icon_off.svg?raw';
import iconOnSvg from '../shared/icons/icon_on.svg?raw';
import iconZipDownloadingSvg from '../shared/icons/icon_zip_downloading.svg?raw';
import iconZipFailedSvg from '../shared/icons/icon_zip_failed.svg?raw';
import iconZipNetworkErrorSvg from '../shared/icons/icon_zip_network error.svg?raw';
import iconZipSuccessfulSvg from '../shared/icons/icon_zip_successful.svg?raw';
import iconZipSvg from '../shared/icons/icon_zip.svg?raw';
import { EXTENSION_NAME } from '../shared/constants';
import {
  isValidDownloadStatusSnapshot,
  type DownloadStatusAction,
  type DownloadStatusSnapshot,
  type DownloadStatusVariant,
} from '../shared/download-status';
import {
  popupActions,
  runtimeActions,
  type ContentResponse,
  type PopupToContentMessage,
  type RuntimeMessage,
  type RuntimeResponse,
} from '../shared/messages';
import {
  getDownloadStateForTab,
  getEnabled,
  setEnabled,
  watchDownloadStates,
} from '../shared/storage';
import { isMobbinUrl } from '../shared/url';

type MessageTone = 'active' | 'inactive' | 'info' | 'warning' | 'error';

const downloadStatusIconMap: Record<DownloadStatusVariant, string> = {
  scrolling: iconLoadingSvg,
  downloading: iconZipDownloadingSvg,
  retrying: iconZipDownloadingSvg,
  packaging: iconZipSvg,
  success: iconZipSuccessfulSvg,
  download_failed: iconZipFailedSvg,
  partial_failed: iconZipFailedSvg,
  network_error: iconZipNetworkErrorSvg,
};

function getRequiredElement<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const node = document.getElementById(id);

  if (!(node instanceof ctor)) {
    throw new Error(`Missing required popup element: ${id}`);
  }

  return node;
}

function getSteadyStateMessage(enabled: boolean): { text: string; tone: MessageTone } {
  if (enabled) {
    return {
      text: '查看器已启用。打开 Mobbin 即可正常浏览',
      tone: 'active',
    };
  }

  return {
    text: '查看器已关闭',
    tone: 'inactive',
  };
}

function getActivationProgressMessage(enabled: boolean): { text: string; tone: MessageTone } {
  return {
    text: enabled ? '正在启用查看器...' : '正在关闭查看器...',
    tone: 'info',
  };
}

function isDisconnectedContentScriptError(message: string): boolean {
  return /receiving end does not exist|could not establish connection|message port closed/i.test(
    message,
  );
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function getActiveMobbinTab(): Promise<chrome.tabs.Tab | null> {
  const activeTab = await getActiveTab();

  if (!activeTab?.id || !isMobbinUrl(activeTab.url)) {
    return null;
  }

  return activeTab;
}

function getMessageIcon(tone: MessageTone): string {
  return tone === 'inactive' ? iconOffSvg : iconOnSvg;
}

function setMessage(text: string, tone: MessageTone): void {
  const message = getRequiredElement('status-message', HTMLParagraphElement);
  const messageText = getRequiredElement('status-message-text', HTMLSpanElement);
  const messageIcon = getRequiredElement('status-message-icon', HTMLSpanElement);

  message.dataset.tone = tone;
  messageText.textContent = text;
  messageIcon.innerHTML = getMessageIcon(tone);
}

function clearDownloadStatus(): void {
  const section = getRequiredElement('download-status-section', HTMLElement);
  const icon = getRequiredElement('download-status-icon', HTMLSpanElement);
  const title = getRequiredElement('download-status-title', HTMLParagraphElement);
  const detail = getRequiredElement('download-status-detail', HTMLParagraphElement);
  const actions = getRequiredElement('download-status-actions', HTMLDivElement);

  section.hidden = true;
  icon.innerHTML = '';
  title.textContent = '';
  detail.textContent = '';
  actions.replaceChildren();
  actions.hidden = true;
}

function createActionButton(
  action: DownloadStatusAction,
  onClick: (action: DownloadStatusAction) => Promise<void>,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `download-action-button download-action-button--${action.level}`;
  button.textContent = action.label;
  button.addEventListener('click', () => {
    void onClick(action);
  });
  return button;
}

function renderDownloadStatus(
  snapshot: DownloadStatusSnapshot | null,
  onAction: (action: DownloadStatusAction) => Promise<void>,
): void {
  if (!isValidDownloadStatusSnapshot(snapshot)) {
    clearDownloadStatus();
    return;
  }

  const section = getRequiredElement('download-status-section', HTMLElement);
  const icon = getRequiredElement('download-status-icon', HTMLSpanElement);
  const title = getRequiredElement('download-status-title', HTMLParagraphElement);
  const detail = getRequiredElement('download-status-detail', HTMLParagraphElement);
  const actions = getRequiredElement('download-status-actions', HTMLDivElement);

  section.hidden = false;
  icon.innerHTML = downloadStatusIconMap[snapshot.variant];
  title.textContent = snapshot.filename;
  detail.textContent = snapshot.detail;
  actions.replaceChildren(...snapshot.actions.map((action) => createActionButton(action, onAction)));
  actions.hidden = snapshot.actions.length === 0;
}

async function sendMessageToTab(
  tabId: number,
  message: PopupToContentMessage,
): Promise<ContentResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response?: ContentResponse) => {
      const runtimeError = chrome.runtime.lastError?.message;

      if (runtimeError) {
        resolve({
          ok: false,
          error: runtimeError,
        });
        return;
      }

      if (!response) {
        resolve({ ok: false, error: '当前页面没有返回状态。' });
        return;
      }

      resolve(response);
    });
  });
}

async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response?: RuntimeResponse) => {
      const runtimeError = chrome.runtime.lastError?.message;

      if (runtimeError) {
        resolve({
          ok: false,
          error: runtimeError,
        });
        return;
      }

      if (!response) {
        resolve({ ok: false, error: '扩展后台没有返回状态。' });
        return;
      }

      resolve(response);
    });
  });
}

async function syncActiveTab(enabled: boolean): Promise<ContentResponse> {
  const activeTab = await getActiveTab();

  if (!activeTab?.id) {
    return { ok: true, message: '设置已保存。' };
  }

  if (!isMobbinUrl(activeTab.url)) {
    return { ok: true, message: '设置已保存。请打开 mobbin.com 页面使用。' };
  }

  const response = await sendMessageToTab(activeTab.id, {
    type: enabled ? popupActions.enable : popupActions.disable,
  });

  if (!response.ok && isDisconnectedContentScriptError(response.error)) {
    return {
      ok: true,
      message: enabled
        ? '已启用。如未生效，请刷新 Mobbin 页面。'
        : '已停用。如未生效，请刷新 Mobbin 页面。',
    };
  }

  return response;
}

async function handleDownloadAction(action: DownloadStatusAction): Promise<void> {
  if (action.id === 'open_downloads_folder') {
    const response = await sendRuntimeMessage({
      type: runtimeActions.openDownloadsFolder,
    });

    if (!response.ok) {
      setMessage(response.error, 'error');
    }

    return;
  }

  const activeTab = await getActiveMobbinTab();

  if (!activeTab?.id) {
    setMessage('请在 mobbin.com 页面使用下载操作。', 'warning');
    return;
  }

  const response = await sendMessageToTab(activeTab.id, {
    type: popupActions.downloadAction,
    actionId: action.id,
  });

  if (!response.ok) {
    setMessage(
      isDisconnectedContentScriptError(response.error)
        ? '当前页面尚未同步扩展状态，请刷新 Mobbin 页面后再试。'
        : response.error,
      isDisconnectedContentScriptError(response.error) ? 'warning' : 'error',
    );
  }
}

export async function initializePopup(): Promise<void> {
  document.title = EXTENSION_NAME;

  const toggle = getRequiredElement('enabled-toggle', HTMLInputElement);
  const enabled = await getEnabled();
  const steadyState = getSteadyStateMessage(enabled);
  const activeMobbinTab = await getActiveMobbinTab();

  toggle.checked = enabled;
  setMessage(steadyState.text, steadyState.tone);
  renderDownloadStatus(
    activeMobbinTab?.id ? await getDownloadStateForTab(activeMobbinTab.id) : null,
    handleDownloadAction,
  );

  const unwatchDownloadStates = watchDownloadStates((states) => {
    if (!activeMobbinTab?.id) {
      clearDownloadStatus();
      return;
    }

    renderDownloadStatus(states[String(activeMobbinTab.id)] ?? null, handleDownloadAction);
  });

  window.addEventListener('unload', () => {
    unwatchDownloadStates();
  });

  toggle.addEventListener('change', async () => {
    const nextValue = toggle.checked;
    toggle.disabled = true;

    const inProgressMessage = getActivationProgressMessage(nextValue);
    setMessage(inProgressMessage.text, inProgressMessage.tone);

    try {
      await setEnabled(nextValue);
      const result = await syncActiveTab(nextValue);

      if (!result.ok) {
        toggle.checked = !nextValue;
        await setEnabled(!nextValue);
        setMessage(result.error, 'error');
        return;
      }

      const nextState = getSteadyStateMessage(nextValue);
      setMessage(result.message ?? nextState.text, result.message ? 'info' : nextState.tone);
    } catch (error) {
      toggle.checked = !nextValue;
      await setEnabled(!nextValue);
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存失败。', 'error');
    } finally {
      toggle.disabled = false;
    }
  });
}
