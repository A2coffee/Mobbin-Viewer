export type DownloadStatusVariant =
  | 'scrolling'
  | 'downloading'
  | 'retrying'
  | 'packaging'
  | 'success'
  | 'download_failed'
  | 'partial_failed'
  | 'network_error';

export type DownloadStatusActionId = 'retry' | 'keep' | 'open_downloads_folder';
export type DownloadStatusActionLevel = 'lv1' | 'lv2';

export type DownloadStatusAction = {
  id: DownloadStatusActionId;
  label: string;
  level: DownloadStatusActionLevel;
};

export type DownloadStatusSnapshot = {
  variant: DownloadStatusVariant;
  filename: string;
  detail: string;
  actions: DownloadStatusAction[];
  updatedAt: number;
};

const DOWNLOAD_ACTIONS: Record<DownloadStatusActionId, DownloadStatusAction> = {
  retry: {
    id: 'retry',
    label: '重试',
    level: 'lv1',
  },
  keep: {
    id: 'keep',
    label: '保留',
    level: 'lv2',
  },
  open_downloads_folder: {
    id: 'open_downloads_folder',
    label: '查看',
    level: 'lv1',
  },
};

export function getDownloadStatusAction(actionId: DownloadStatusActionId): DownloadStatusAction {
  return { ...DOWNLOAD_ACTIONS[actionId] };
}

export function buildDownloadStatusActions(
  actionIds: DownloadStatusActionId[],
): DownloadStatusAction[] {
  return actionIds.map((actionId) => getDownloadStatusAction(actionId));
}

export function isValidDownloadStatusSnapshot(
  snapshot: unknown,
): snapshot is DownloadStatusSnapshot {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return false;
  }

  const candidate = snapshot as Partial<DownloadStatusSnapshot>;
  return (
    typeof candidate.variant === 'string'
    && typeof candidate.filename === 'string'
    && candidate.filename.trim().length > 0
    && typeof candidate.detail === 'string'
    && candidate.detail.trim().length > 0
    && Array.isArray(candidate.actions)
    && typeof candidate.updatedAt === 'number'
  );
}
