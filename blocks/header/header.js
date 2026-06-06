/**
 * Loads the header fragment for both overlay and native EDS pages.
 *
 * For overlay pages: uses main.dataset.overlay to find /fragments/<template>/header.html
 * For native pages: determines indication (uc/ms) from the URL path and loads
 *   /fragments/nav/<indication>.plain.html (DA-served fragment)
 */
export default async function decorate(block) {
  let path;

  const template = document.querySelector('main')?.dataset?.overlay;
  if (template) {
    // Overlay page — use existing template-specific fragment from code bus
    path = `/fragments/${template}/header.html`;
    const resp = await fetch(path);
    if (!resp.ok) return;
    block.innerHTML = await resp.text();
  } else {
    // Native EDS page — load DA-authored nav fragment
    const url = window.location.pathname;
    let indication = 'uc';
    if (url.includes('/multiple-sclerosis')) {
      indication = 'ms';
    } else if (url.includes('/ulcerative-colitis')) {
      indication = 'uc';
    }
    const fragPath = `/fragments/nav/${indication}`;
    const resp = await fetch(`${fragPath}.plain.html`);
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[header] fragment not found at ${fragPath}.plain.html`);
      return;
    }
    block.innerHTML = await resp.text();
  }
}
