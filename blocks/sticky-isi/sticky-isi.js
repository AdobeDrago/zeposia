/**
 * Sticky ISI Bar Block — ZEPOSIA HCP (EDS)
 *
 * Fixed-bottom Important Safety Information bar with expand/collapse behavior.
 * Matches the legacy zeposiahcp.com ISI drawer appearance and behavior.
 *
 * Behavior:
 * - Fixed at viewport bottom, always visible while scrolling
 * - Collapsed state: shows header + preview of ISI content (clipped with overflow)
 * - Expanded state: shows full scrollable ISI content (max ~50vh)
 * - Toggle via + EXPAND / − COLLAPSE button
 * - Scroll-direction reactive: expand on scroll up, collapse on scroll down
 * - Auto-hides when the inline/full ISI section scrolls into view
 * - Supports UC (blue) and MS (red) indication variants via CSS custom properties
 *
 * Authored content structure (in the document):
 *   +---------------------------+
 *   | sticky-isi                |
 *   +===========================+
 *   | <ISI content or fragment> |
 *   +---------------------------+
 *
 * The first row/cell contains the full ISI HTML (typically loaded from a fragment).
 */

const AUTO_HIDE_SELECTOR = '.section.isi-container, .section[data-isi], [data-full-isi]';

/**
 * Detect current indication from URL path or body class.
 * @returns {'uc'|'ms'}
 */
function getIndication() {
  const path = window.location.pathname;
  if (path.startsWith('/multiple-sclerosis') || path.startsWith('/ms')) return 'ms';
  if (document.body.classList.contains('ms')) return 'ms';
  return 'uc';
}

/**
 * Create the toggle button element with +/− icon and EXPAND/COLLAPSE label.
 * @param {boolean} expanded — current state
 * @returns {HTMLButtonElement}
 */
function createToggleButton(expanded) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sticky-isi-toggle';
  btn.setAttribute('aria-label', expanded ? 'Collapse safety information' : 'Expand safety information');
  btn.setAttribute('aria-expanded', String(expanded));
  const icon = expanded ? '−' : '+';
  const label = expanded ? 'COLLAPSE' : 'EXPAND';
  btn.innerHTML = `<span class="sticky-isi-toggle-icon">${icon}</span> <span class="sticky-isi-toggle-label">${label}</span>`;
  return btn;
}

/**
 * Build the sticky ISI DOM structure from authored block content.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const indication = getIndication();
  block.dataset.indication = indication;

  // Extract authored ISI content from the block's table rows
  const rows = [...block.querySelectorAll(':scope > div')];
  const isiContentSource = rows[0]?.querySelector('div') || rows[0];
  const isiHTML = isiContentSource ? isiContentSource.innerHTML : '';

  // Clear original block content
  block.textContent = '';

  // --- Build collapsed (preview) view ---
  const previewContainer = document.createElement('div');
  previewContainer.className = 'sticky-isi-preview';

  const header = document.createElement('div');
  header.className = 'sticky-isi-header';

  const title = document.createElement('span');
  title.className = 'sticky-isi-title';
  title.textContent = 'IMPORTANT SAFETY INFORMATION';

  const toggleBtn = createToggleButton(false);

  header.append(title, toggleBtn);

  // Preview content: show the full ISI HTML, clipped by CSS overflow
  const previewContent = document.createElement('div');
  previewContent.className = 'sticky-isi-preview-content';
  previewContent.innerHTML = isiHTML;

  previewContainer.append(header, previewContent);

  // --- Build expanded view ---
  const expandContainer = document.createElement('div');
  expandContainer.className = 'sticky-isi-expand';
  expandContainer.hidden = true;

  const expandHeader = document.createElement('div');
  expandHeader.className = 'sticky-isi-header';

  const expandTitle = document.createElement('span');
  expandTitle.className = 'sticky-isi-title';
  expandTitle.textContent = 'IMPORTANT SAFETY INFORMATION';

  const collapseBtn = createToggleButton(true);

  expandHeader.append(expandTitle, collapseBtn);

  const expandContent = document.createElement('div');
  expandContent.className = 'sticky-isi-expand-content';
  expandContent.innerHTML = isiHTML;
  expandContent.setAttribute('role', 'region');
  expandContent.setAttribute('aria-label', 'Important Safety Information');
  expandContent.tabIndex = 0;

  expandContainer.append(expandHeader, expandContent);

  // --- Assemble block ---
  block.append(previewContainer, expandContainer);

  // --- State Management ---
  let expanded = false;

  function updateToggleButtons() {
    block.querySelectorAll('.sticky-isi-toggle').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(expanded));
      btn.setAttribute('aria-label', expanded ? 'Collapse safety information' : 'Expand safety information');
      const icon = btn.querySelector('.sticky-isi-toggle-icon');
      const label = btn.querySelector('.sticky-isi-toggle-label');
      if (icon) icon.textContent = expanded ? '−' : '+';
      if (label) label.textContent = expanded ? 'COLLAPSE' : 'EXPAND';
    });
  }

  function setExpanded(value) {
    expanded = value;
    block.classList.toggle('is-expanded', expanded);
    block.classList.toggle('is-collapsed', !expanded);
    previewContainer.hidden = expanded;
    expandContainer.hidden = !expanded;
    updateToggleButtons();

    // Focus management: when expanding, focus the scrollable content
    if (expanded) {
      expandContent.focus({ preventScroll: true });
    }
  }

  // --- Event Listeners ---
  toggleBtn.addEventListener('click', () => setExpanded(true));
  collapseBtn.addEventListener('click', () => setExpanded(false));

  // Keyboard: Escape to collapse
  block.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expanded) {
      setExpanded(false);
      toggleBtn.focus();
    }
  });

  // --- Auto-collapse when full ISI section is visible in viewport ---
  function setupAutoCollapse() {
    const fullIsiSection = document.querySelector(AUTO_HIDE_SELECTOR);
    if (!fullIsiSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
            // Full ISI is visible — hide sticky bar
            block.classList.add('is-hidden');
          } else {
            block.classList.remove('is-hidden');
          }
        });
      },
      {
        threshold: [0, 0.1, 0.25],
        rootMargin: '0px 0px -10% 0px',
      },
    );

    observer.observe(fullIsiSection);
  }

  // --- Scroll-direction reactive behavior ---
  // Scroll down → collapse (tray), Scroll up → expand (fly out)
  function setupScrollDirectionTracking() {
    let lastScrollY = window.scrollY;
    let ticking = false;
    const SCROLL_THRESHOLD = 10; // minimum px delta to trigger state change

    function onScroll() {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;

        // Only react if we've scrolled past the threshold and ISI isn't hidden
        if (Math.abs(delta) > SCROLL_THRESHOLD && !block.classList.contains('is-hidden')) {
          if (delta > 0 && expanded) {
            // Scrolling DOWN → collapse to tray
            setExpanded(false);
          } else if (delta < 0 && !expanded) {
            // Scrolling UP → expand (fly out)
            setExpanded(true);
          }
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Initialize state
  block.classList.add('is-collapsed');
  setExpanded(false);

  // Defer auto-collapse and scroll tracking setup to allow page to fully render
  function initBehaviors() {
    setupAutoCollapse();
    setupScrollDirectionTracking();
  }

  if (document.readyState === 'complete') {
    initBehaviors();
  } else {
    window.addEventListener('load', initBehaviors, { once: true });
  }
}
