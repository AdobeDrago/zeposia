/**
 * Loads the header fragment for both overlay and native EDS pages.
 *
 * For overlay pages: uses main.dataset.overlay to find /fragments/<template>/header.html
 * For native pages: determines indication (uc/ms) from the URL path and loads
 *   /fragments/nav/<indication>.plain.html (DA-served fragment)
 */
export default async function decorate(block) {
  const template = document.querySelector('main')?.dataset?.overlay;
  const isUC = window.location.pathname.includes('/ulcerative-colitis');

  // UC pages always use the native DA-authored nav for consistency
  if (template && !isUC) {
    // Non-UC overlay page — use existing template-specific fragment from code bus
    const path = `/fragments/${template}/header.html`;
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

    // Ensure all legacy nav links are present
    const ul = block.querySelector(':scope > div > ul');
    if (ul && indication === 'uc') {
      const existingLinks = [...ul.querySelectorAll(':scope > li a')].map((a) => a.textContent.trim());

      // Insert BMS Resources before Visit Patient Site
      const visitLi = [...ul.querySelectorAll(':scope > li')].find(
        (li) => li.textContent.trim().startsWith('Visit Patient Site'),
      );
      if (visitLi && !existingLinks.includes('BMS Resources')) {
        const li = document.createElement('li');
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = 'https://www.bms.com/patient-and-caregiver/resources.html';
        a.textContent = 'BMS Resources';
        p.append(a);
        li.append(p);
        visitLi.before(li);
      }

      // Append Indications at end
      if (!existingLinks.includes('Indications')) {
        const li = document.createElement('li');
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = '#indications';
        a.textContent = 'Indications';
        a.classList.add('nav-ind-link');
        p.append(a);
        li.append(p);
        ul.append(li);
      }
    }
  }
}
