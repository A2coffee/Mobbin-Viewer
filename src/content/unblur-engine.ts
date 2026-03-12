import {
  PROCESSED_CONTAINER_ATTR,
  PROCESSED_MEDIA_ATTR,
  STYLE_ELEMENT_ID,
} from '../shared/constants';

export function ensureRuntimeStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .mobbin-viewer-unblur,
    .mobbin-viewer-unblur::before,
    .mobbin-viewer-unblur::after {
      filter: none !important;
      backdrop-filter: none !important;
      background: transparent !important;
      opacity: 1 !important;
      visibility: visible !important;
      content: none !important;
    }

    .mobbin-viewer-force-show {
      display: revert !important;
    }

    .mobbin-viewer-host {
      position: relative;
      isolation: isolate;
      z-index: 0;
    }

    .mobbin-viewer-host:hover,
    .mobbin-viewer-host:focus-within {
      z-index: 2147483000;
    }

    .mobbin-viewer-controls {
      position: absolute;
      inset: 0;
      z-index: 2147483001;
      pointer-events: none;
    }

    .mobbin-viewer-top-actions {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.22s ease, transform 0.22s ease;
    }

    .mobbin-viewer-bottom-actions {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.22s ease, transform 0.22s ease;
    }

    .mobbin-viewer-host:hover .mobbin-viewer-top-actions,
    .mobbin-viewer-host:hover .mobbin-viewer-bottom-actions,
    .mobbin-viewer-host:focus-within .mobbin-viewer-top-actions,
    .mobbin-viewer-host:focus-within .mobbin-viewer-bottom-actions {
      opacity: 1;
      transform: translateY(0);
    }

    .mobbin-viewer-button {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px;
      border: none;
      border-radius: 999px;
      background: rgba(10, 18, 31, 0.86);
      color: #fff;
      cursor: pointer;
      font: 600 13px/1 "Segoe UI", "Microsoft YaHei", sans-serif;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
      transition:
        transform 0.16s ease,
        background 0.16s ease,
        opacity 0.16s ease;
    }

    .mobbin-viewer-button:hover {
      background: rgba(10, 18, 31, 0.95);
      transform: translateY(-1px);
    }

    .mobbin-viewer-button:disabled {
      opacity: 0.6;
      cursor: wait;
      transform: none;
    }

    .mobbin-viewer-button--icon {
      width: 40px;
      min-width: 40px;
      padding: 0;
    }

    .mobbin-viewer-button--single {
      grid-column: 1 / -1;
    }

    .mobbin-viewer-lightbox {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(7, 13, 25, 0.94);
      backdrop-filter: blur(10px);
      opacity: 0;
      transition: opacity 0.24s ease;
    }

    .mobbin-viewer-lightbox.is-visible {
      opacity: 1;
    }

    .mobbin-viewer-lightbox-media {
      max-width: 100vw;
      max-height: 100vh;
      object-fit: contain;
      transform-origin: center;
      will-change: transform;
      user-select: none;
      -webkit-user-drag: none;
    }

    .mobbin-viewer-lightbox-close {
      position: absolute;
      top: 18px;
      right: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 42px;
      height: 42px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      cursor: pointer;
      appearance: none;
      line-height: 0;
    }

    .mobbin-viewer-lightbox-close svg {
      display: block;
      flex: none;
    }

    .mobbin-viewer-lightbox-spinner {
      position: absolute;
      display: inline-flex;
      align-items: center;
      padding: 18px 22px;
      border-radius: 18px;
      background: rgba(10, 18, 31, 0.94);
      color: #fff;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }

    .mobbin-viewer-download-toast-region {
      position: fixed;
      top: 32px;
      right: 32px;
      z-index: 2147483646;
      width: min(360px, calc(100vw - 64px));
      pointer-events: none;
    }

    .mobbin-viewer-download-toast {
      pointer-events: auto;
      border-radius: 24px;
      background: #141414;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.32);
      overflow: hidden;
    }

    .mobbin-viewer-download-toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
    }

    .mobbin-viewer-download-toast-icon {
      display: inline-flex;
      flex: 0 0 auto;
      width: 17px;
      height: 17px;
      color: #ffffff;
    }

    .mobbin-viewer-download-toast-icon svg {
      display: block;
      width: 17px;
      height: 17px;
    }

    .mobbin-viewer-download-toast-copy {
      display: flex;
      min-width: 0;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 6px;
    }

    .mobbin-viewer-download-toast-title,
    .mobbin-viewer-download-toast-detail {
      margin: 0;
      font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12px;
    }

    .mobbin-viewer-download-toast-title {
      overflow: hidden;
      color: #ffffff;
      font-weight: 400;
      line-height: 1.45;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobbin-viewer-download-toast-detail {
      color: #707070;
      font-weight: 400;
      line-height: 1.4;
    }

    .mobbin-viewer-download-toast-actions {
      display: flex;
      flex: 0 0 auto;
      gap: 12px;
      margin-left: 12px;
    }

    .mobbin-viewer-toast-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 33px;
      padding: 7.5px 12px;
      border-radius: 999px;
      font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.45;
      cursor: pointer;
      transition:
        background 0.16s ease,
        border-color 0.16s ease,
        box-shadow 0.16s ease,
        transform 0.16s ease;
      white-space: nowrap;
    }

    .mobbin-viewer-toast-button:hover {
      transform: translateY(-1px);
    }

    .mobbin-viewer-toast-button--lv1 {
      border: 2px solid #ffffff;
      background: #e6e6e6;
      color: #000000;
      box-shadow: none;
    }

    .mobbin-viewer-toast-button--lv1:hover {
      background: #ffffff;
      box-shadow: -8px 4px 12px rgba(255, 255, 255, 0.1);
    }

    .mobbin-viewer-toast-button--lv2 {
      border: 1.5px solid #3e3f40;
      background: #141414;
      color: #ffffff;
      box-shadow: none;
    }

    .mobbin-viewer-toast-button--lv2:hover {
      border-color: #707070;
      background: #101010;
    }

    .mobbin-viewer-status-spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      border: 2px solid rgba(255, 255, 255, 0.28);
      border-top-color: #fff;
      border-radius: 50%;
      animation: mobbin-viewer-spin 1s linear infinite;
      vertical-align: -3px;
    }

    @media (max-width: 520px) {
      .mobbin-viewer-download-toast-region {
        top: 16px;
        right: 16px;
        width: calc(100vw - 32px);
      }

      .mobbin-viewer-download-toast-content {
        padding: 20px;
      }
    }

    @keyframes mobbin-viewer-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(style);
}

export function removeRuntimeStyles(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
}

export function removeBlurFromAncestors(
  element: HTMLElement,
  maxLevels = 8,
): void {
  element.style.opacity = '1';
  element.style.visibility = 'visible';
  element.style.filter = 'none';

  let current: HTMLElement | null = element.parentElement;
  let level = 0;

  while (current && level < maxLevels) {
    if (current.classList.contains('pointer-events-none')) {
      current.classList.remove('pointer-events-none');
      current.style.pointerEvents = 'auto';
    }

    const classNames = Array.from(current.classList);
    const hasBlurClass = classNames.some((className) =>
      className.includes('blur') || className.includes('backdrop-blur'),
    );

    if (hasBlurClass) {
      current.style.setProperty('filter', 'none', 'important');
      current.style.setProperty('backdrop-filter', 'none', 'important');
      current.style.setProperty('--tw-backdrop-blur', 'none');
      current.style.setProperty('--tw-blur', 'none');
      current.classList.add('mobbin-viewer-unblur');
    }

    const styleText = current.getAttribute('style') ?? '';
    if (
      styleText.includes('display: none') &&
      (styleText.includes('pointer-events: auto') || styleText.includes('backdrop-filter: none'))
    ) {
      current.classList.add('mobbin-viewer-force-show');
      current.style.opacity = '1';
      current.style.visibility = 'visible';
    }

    current
      .querySelectorAll('[class*="backdrop-blur"], [class*="after:backdrop-blur"]')
      .forEach((overlay) => {
        if (overlay instanceof HTMLElement && overlay !== element && !overlay.contains(element)) {
          overlay.style.display = 'none';
          overlay.classList.add('mobbin-viewer-unblur');
        }
      });

    current = current.parentElement;
    level += 1;
  }
}

export function findSuitableContainer(
  element: HTMLElement,
  maxLevels = 5,
): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  let level = 0;

  while (current && level < maxLevels) {
    const style = getComputedStyle(current);
    const positioned = style.position === 'relative' || style.position === 'absolute';
    const grouped = current.classList.contains('group') || current.classList.contains('group/cell');
    const largeEnough = current.offsetWidth > 100 && current.offsetHeight > 100;
    const looksLikeScreen =
      current.classList.contains('mobile-screen-border-radius') ||
      current.classList.contains('screen-inset-border');

    if ((positioned && largeEnough) || grouped || looksLikeScreen) {
      return current;
    }

    current = current.parentElement;
    level += 1;
  }

  return element.parentElement;
}

export function ensureContainerState(container: HTMLElement): void {
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  container.classList.add('mobbin-viewer-host');
  container.setAttribute(PROCESSED_CONTAINER_ATTR, 'true');
}

export function isInDetailView(element: HTMLElement): boolean {
  if (element.closest('[role="dialog"]') || element.closest('#mobbin-viewer-lightbox')) {
    return true;
  }

  const url = window.location.href;
  return url.includes('/screens/') && !url.includes('/screens?');
}

export function isInExcludedPanel(element: HTMLElement): boolean {
  return Boolean(
    element.closest('header') ||
      element.closest('[role="banner"]') ||
      element.closest('[data-sentry-source-file*="SearchBar"]') ||
      element.closest('[data-sentry-source-file="FilterTagHoverCard.tsx"]') ||
      element.closest('aside'),
  );
}

export function hideStickyAside(): void {
  const aside = document.querySelector('aside.sticky.z-10.my-32.overflow-x-clip');
  if (aside instanceof HTMLElement) {
    aside.style.display = 'none';
  }
}

export function clearProcessingMarkers(): void {
  document.querySelectorAll(`[${PROCESSED_MEDIA_ATTR}], [${PROCESSED_CONTAINER_ATTR}]`).forEach((node) => {
    node.removeAttribute(PROCESSED_MEDIA_ATTR);
    node.removeAttribute(PROCESSED_CONTAINER_ATTR);
  });
}
