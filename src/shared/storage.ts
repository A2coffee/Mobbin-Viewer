import {
  DOWNLOAD_STATES_STORAGE_KEY,
  ENABLED_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
} from './constants';
import {
  isValidDownloadStatusSnapshot,
  type DownloadStatusSnapshot,
} from './download-status';

type DownloadStatesByTab = Record<string, DownloadStatusSnapshot>;

let initializationPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const current = await chrome.storage.local.get([ENABLED_STORAGE_KEY]);

      if (typeof current[ENABLED_STORAGE_KEY] !== 'boolean') {
        await chrome.storage.local.set({ [ENABLED_STORAGE_KEY]: true });
      }

      await chrome.storage.local.remove([...LEGACY_STORAGE_KEYS]);
    })().catch(() => undefined);
  }

  await initializationPromise;
}

function normalizeDownloadStates(value: unknown): DownloadStatesByTab {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, DownloadStatusSnapshot>).reduce<DownloadStatesByTab>(
    (states, [tabId, snapshot]) => {
      if (isValidDownloadStatusSnapshot(snapshot)) {
        states[tabId] = snapshot;
      }

      return states;
    },
    {},
  );
}

export async function getEnabled(): Promise<boolean> {
  try {
    await ensureInitialized();
    const current = await chrome.storage.local.get([ENABLED_STORAGE_KEY]);
    return typeof current[ENABLED_STORAGE_KEY] === 'boolean' ? current[ENABLED_STORAGE_KEY] : true;
  } catch {
    return true;
  }
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await ensureInitialized();
  await chrome.storage.local.set({ [ENABLED_STORAGE_KEY]: enabled });
}

export async function getAllDownloadStates(): Promise<DownloadStatesByTab> {
  await ensureInitialized();
  const current = await chrome.storage.local.get([DOWNLOAD_STATES_STORAGE_KEY]);
  return normalizeDownloadStates(current[DOWNLOAD_STATES_STORAGE_KEY]);
}

export async function getDownloadStateForTab(tabId: number): Promise<DownloadStatusSnapshot | null> {
  const states = await getAllDownloadStates();
  return states[String(tabId)] ?? null;
}

export async function setDownloadStateForTab(
  tabId: number,
  snapshot: DownloadStatusSnapshot,
): Promise<void> {
  const states = await getAllDownloadStates();
  states[String(tabId)] = snapshot;
  await chrome.storage.local.set({ [DOWNLOAD_STATES_STORAGE_KEY]: states });
}

export async function clearDownloadStateForTab(tabId: number): Promise<void> {
  const states = await getAllDownloadStates();
  delete states[String(tabId)];
  await chrome.storage.local.set({ [DOWNLOAD_STATES_STORAGE_KEY]: states });
}

export function watchEnabled(listener: (enabled: boolean) => void): () => void {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !(ENABLED_STORAGE_KEY in changes)) {
      return;
    }

    listener(Boolean(changes[ENABLED_STORAGE_KEY]?.newValue));
  };

  chrome.storage.onChanged.addListener(onChanged);

  return () => chrome.storage.onChanged.removeListener(onChanged);
}

export function watchDownloadStates(listener: (states: DownloadStatesByTab) => void): () => void {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !(DOWNLOAD_STATES_STORAGE_KEY in changes)) {
      return;
    }

    listener(normalizeDownloadStates(changes[DOWNLOAD_STATES_STORAGE_KEY]?.newValue));
  };

  chrome.storage.onChanged.addListener(onChanged);

  return () => chrome.storage.onChanged.removeListener(onChanged);
}
