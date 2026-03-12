import type { DownloadStatusActionId, DownloadStatusSnapshot } from './download-status';

export const popupActions = {
  enable: 'ENABLE',
  disable: 'DISABLE',
  ping: 'PING',
  downloadAction: 'DOWNLOAD_ACTION',
} as const;

export const runtimeActions = {
  openDownloadsFolder: 'OPEN_DOWNLOADS_FOLDER',
  syncDownloadState: 'SYNC_DOWNLOAD_STATE',
  clearDownloadState: 'CLEAR_DOWNLOAD_STATE',
} as const;

export type PopupAction = (typeof popupActions)[keyof typeof popupActions];
export type RuntimeAction = (typeof runtimeActions)[keyof typeof runtimeActions];

export type PopupToContentMessage =
  | {
      type: typeof popupActions.enable | typeof popupActions.disable | typeof popupActions.ping;
    }
  | {
      type: typeof popupActions.downloadAction;
      actionId: DownloadStatusActionId;
    };

export type RuntimeMessage =
  | {
      type: typeof runtimeActions.openDownloadsFolder;
    }
  | {
      type: typeof runtimeActions.syncDownloadState;
      snapshot: DownloadStatusSnapshot;
    }
  | {
      type: typeof runtimeActions.clearDownloadState;
    };

export type ContentResponse =
  | {
      ok: true;
      state?: 'enabled' | 'disabled';
      message?: string;
      downloadStatus?: DownloadStatusSnapshot | null;
    }
  | {
      ok: false;
      error: string;
    };

export type RuntimeResponse =
  | {
      ok: true;
      message?: string;
    }
  | {
      ok: false;
      error: string;
    };
