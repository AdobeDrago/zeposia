/**
 * Loads the header fragment for both overlay and native EDS pages.
 * 
 * For overlay pages: uses main.dataset.overlay to find /fragments/<template>/header.html
 * For native pages: determines indication (uc/ms) from the URL path and loads
 *   /fragments/nav/<indication>.html
 */
export default async function decorate(block) {
  let path;
  
  const template = document.querySelector('main')?.dataset?.overlay;
  if (template) {
    // Overlay page — use existing template-specific fragment
    path = `/fragments/${template}/header.html`;
  } else {
    // Native EDS page — determine indication from URL
    const url = window.location.pathname;
    let indication = 'uc'; // default
    if (url.includes('/multiple-sclerosis')) {
      indication = 'ms';
    } else if (url.includes('/ulcerative-colitis')) {
      indication = 'uc';
    }
    path = `/fragments/nav/${indication}.html`;
  }

  const resp = await fetch(`${window.hlx.codeBasePath}${path}`);
  if (!resp.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[header] fragment not found at ${path}`);
    return;
  }
  block.innerHTML = await resp.text();
}
