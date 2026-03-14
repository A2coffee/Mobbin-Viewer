const MOBBIN_IMAGE_REGEX =
  /https:\/\/bytescale\.mobbin\.com\/.*?\/(app_screens|content\/sites|app_overview|app_row_preview)\/[^?]+\.(png|jpg|jpeg|webp|mp4)/i;
const MOBBIN_VIDEO_REGEX =
  /https:\/\/bytescale\.mobbin\.com\/.*?\/(app_flow_videos|content\/sites)\/[^?]+\.mp4/i;
const MOBBIN_VIDEO_HOST_REGEX = /https:\/\/bytescale\.mobbin\.com\//i;

const WATERMARK_PATH = '/mobbin.com/prod/watermark/1.0/78e3a61c-21ac-490e-b93d-c7206f6d3bfb';

export function isMobbinScreenImage(url: string): boolean {
  return Boolean(url) && MOBBIN_IMAGE_REGEX.test(url);
}

export function isMobbinVideoPoster(url: string): boolean {
  return Boolean(url) && MOBBIN_VIDEO_REGEX.test(url);
}

export function isMobbinVideoSource(url: string): boolean {
  return Boolean(url) && MOBBIN_VIDEO_HOST_REGEX.test(url) && /\.mp4(\?|$)/i.test(url);
}

export function isImageRepresentingVideo(url: string): boolean {
  return /\.mp4(\?|$)/i.test(url);
}

export function normalizePresentationImageUrl(url: string): string {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (parsed.searchParams.get('w') === '1920' && parsed.searchParams.get('f') === 'webp') {
      return parsed.toString();
    }

    parsed.searchParams.set('f', 'webp');
    parsed.searchParams.set('w', '1920');
    parsed.searchParams.set('q', '85');
    parsed.searchParams.set('fit', 'shrink-cover');
    parsed.searchParams.set('extend-bottom', '120');
    parsed.searchParams.set('image', WATERMARK_PATH);
    parsed.searchParams.set('gravity', 'bottom');
    parsed.searchParams.set('v', '1.0');

    return parsed.toString();
  } catch {
    return url;
  }
}

export function normalizeDownloadImageUrl(url: string): string {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const hasWatermark = parsed.searchParams.has('image');
    parsed.searchParams.set('f', 'png');
    parsed.searchParams.set('w', '1920');

    if (!parsed.searchParams.has('q')) {
      parsed.searchParams.set('q', '100');
    }

    // Bytescale rejects some image requests when gravity is set without watermark params.
    if (!hasWatermark) {
      parsed.searchParams.delete('gravity');
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function convertPosterToVideoSrc(posterUrl: string): string {
  if (!posterUrl) {
    return posterUrl;
  }

  try {
    const parsed = new URL(posterUrl);
    parsed.pathname = parsed.pathname.replace('/image/', '/video/');
    parsed.search = '';

    const params = new URLSearchParams({
      f: 'mp4-h264',
      w: '1920',
      hp: '1920',
      sh: '100',
      mute: 'true',
      p: 'mhq',
      q: '73',
      gop: '300',
      sd: 'false',
      rf: '6',
      bf: '7',
      qz: '-1',
      if: '0',
      bo: '-1',
      a: '/video.mp4',
    });

    return `${parsed.origin}${parsed.pathname}?${params.toString()}`;
  } catch {
    return posterUrl;
  }
}

export function getDownloadUrlForMedia(
  media: HTMLImageElement | HTMLVideoElement,
): string | null {
  if (media instanceof HTMLVideoElement) {
    const source = media.currentSrc || media.src;
    if (source && isMobbinVideoSource(source)) {
      return source;
    }

    const poster = media.getAttribute('poster');
    return poster && isMobbinVideoPoster(poster) ? convertPosterToVideoSrc(poster) : null;
  }

  const source = media.currentSrc || media.src;
  return source ? normalizeDownloadImageUrl(source) : null;
}
