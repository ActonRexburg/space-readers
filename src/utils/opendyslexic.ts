/**
 * Inject self-hosted OpenDyslexic @font-face rules (SIL OFL).
 * Uses resolveAssetUrl so GitHub Pages /space-readers/ resolves public/fonts.
 */
import { resolveAssetUrl } from './assets';

export function injectOpenDyslexicFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sr-opendyslexic')) return;

  const style = document.createElement('style');
  style.id = 'sr-opendyslexic';
  const regular = resolveAssetUrl('fonts/OpenDyslexic-Regular.woff2');
  const bold = resolveAssetUrl('fonts/OpenDyslexic-Bold.woff2');
  style.textContent = `
@font-face {
  font-family: 'OpenDyslexic';
  src: url('${regular}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'OpenDyslexic';
  src: url('${bold}') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;
  document.head.appendChild(style);
}
