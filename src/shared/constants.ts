export const EXTENSION_NAME = '借阅 Mobbin';
export const ENABLED_STORAGE_KEY = 'mobbin_viewer_enabled';
export const DOWNLOAD_STATES_STORAGE_KEY = 'mobbin_viewer_download_states';
export const DOWNLOAD_STATUS_FILENAME = 'mobbin_screens.zip';
export const DOWNLOAD_REPORT_FILENAME = 'mobbin_screens.report.json';

export const LEGACY_STORAGE_KEYS = [
  'mobbin_helper_enabled',
  'mobbin_helper_activation_record',
  'mobbin_helper_used_serials',
  'mobbin_helper_auth_token',
  'mobbin_helper_user_info',
  'mobbin_helper_device_id',
] as const;

export const PROCESSED_MEDIA_ATTR = 'data-mobbin-viewer-media';
export const PROCESSED_CONTAINER_ATTR = 'data-mobbin-viewer-container';
export const STYLE_ELEMENT_ID = 'mobbin-viewer-runtime-styles';
export const LIGHTBOX_ID = 'mobbin-viewer-lightbox';
export const STATUS_OVERLAY_ID = 'mobbin-viewer-status-overlay';
export const HEADER_BUTTON_ID = 'mobbin-viewer-batch-download';

export const MOBBIN_MATCH_PATTERNS = ['https://mobbin.com/*', 'https://*.mobbin.com/*'] as const;
