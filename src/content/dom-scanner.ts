import { PROCESSED_MEDIA_ATTR } from '../shared/constants';
import {
  convertPosterToVideoSrc,
  isImageRepresentingVideo,
  isMobbinScreenImage,
  isMobbinVideoPoster,
  isMobbinVideoSource,
  normalizePresentationImageUrl,
} from './media-url-normalizer';
import { ensureMediaControls } from './overlay-ui';
import {
  ensureContainerState,
  findSuitableContainer,
  isInDetailView,
  isInExcludedPanel,
  removeBlurFromAncestors,
} from './unblur-engine';

function ensureContainerControls(media: HTMLImageElement | HTMLVideoElement): void {
  if (isInDetailView(media) || isInExcludedPanel(media)) {
    return;
  }

  const container = findSuitableContainer(media);
  if (!container) {
    return;
  }

  ensureContainerState(container);
  ensureMediaControls(container, media);
}

function convertImageToVideo(image: HTMLImageElement): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = convertPosterToVideoSrc(image.currentSrc || image.src);
  video.loop = true;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.className = image.className;

  const style = image.getAttribute('style');
  if (style) {
    video.setAttribute('style', style);
  }

  video.setAttribute('disablepictureinpicture', '');
  video.setAttribute('disableremoteplayback', '');
  video.setAttribute(PROCESSED_MEDIA_ATTR, 'true');

  image.parentNode?.replaceChild(video, image);
  return video;
}

function processImage(image: HTMLImageElement): void {
  const source = image.currentSrc || image.src;

  if (!isMobbinScreenImage(source) || isInExcludedPanel(image)) {
    return;
  }

  if (isImageRepresentingVideo(source)) {
    const video = image.hasAttribute(PROCESSED_MEDIA_ATTR)
      ? (image.parentElement?.querySelector('video') as HTMLVideoElement | null)
      : convertImageToVideo(image);

    if (video) {
      processVideo(video);
    }

    return;
  }

  const normalized = normalizePresentationImageUrl(source);
  if (normalized !== source) {
    image.src = normalized;
  }

  image.setAttribute(PROCESSED_MEDIA_ATTR, 'true');
  removeBlurFromAncestors(image);
  ensureContainerControls(image);
}

function processVideo(video: HTMLVideoElement): void {
  const source = video.currentSrc || video.src;
  const poster = video.getAttribute('poster');

  if (!source && !poster) {
    return;
  }

  if (!isMobbinVideoSource(source) && !(poster && isMobbinVideoPoster(poster))) {
    return;
  }

  if (video.hasAttribute(PROCESSED_MEDIA_ATTR)) {
    removeBlurFromAncestors(video);
    ensureContainerControls(video);
    return;
  }

  if (!source && poster && isMobbinVideoPoster(poster)) {
    video.src = convertPosterToVideoSrc(poster);
  }

  if (poster && isMobbinVideoPoster(poster)) {
    try {
      const parsed = new URL(poster);
      parsed.searchParams.set('w', '1920');
      video.setAttribute('poster', parsed.toString());
    } catch {
      // Ignore poster normalization failures.
    }
  }

  video.setAttribute(PROCESSED_MEDIA_ATTR, 'true');
  removeBlurFromAncestors(video);
  ensureContainerControls(video);
}

export function scanDocument(): void {
  document.querySelectorAll('img').forEach((node) => {
    processImage(node as HTMLImageElement);
  });

  document.querySelectorAll('video').forEach((node) => {
    processVideo(node as HTMLVideoElement);
  });
}
