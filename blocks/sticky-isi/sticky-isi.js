/**
 * Sticky ISI Bar Block — ZEPOSIA HCP (EDS)
 *
 * Fixed-bottom Important Safety Information bar with expand/collapse behavior.
 *
 * Behavior:
 * - Fixed at viewport bottom, always visible while scrolling
 * - Collapsed state: shows header "IMPORTANT SAFETY INFORMATION" + brief preview text
 * - Expanded state: shows full scrollable ISI content (max ~50vh)
 * - Toggle via chevron button (up-arrow to expand, down-arrow to collapse)
 * - Auto-collapses when the inline/full ISI section scrolls into view
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

const MOBILE_BREAKPOINT = 768;
const EXPANDED_MAX_HEIGHT_VH = 50;
const COLLAPSED_MAX_HEIGHT = '20%';
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
 * Create the toggle/chevron button element.
 * @param {boolean} expanded — current state
 * @returns {HTMLButtonElement}
 */
function createToggleButton(expanded) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sticky-isi-toggle';
  btn.setAttribute('aria-label', expanded ? 'Collapse safety information' : 'Expand safety information');
  btn.setAttribute('aria-expanded', String(expanded));
  btn.innerHTML = `<span class="sticky-isi-arrow ${expanded ? 'arrow-down' : 'arrow-up'}"></span>`;
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

  const previewContent = document.createElement('div');
  previewContent.className = 'sticky-isi-preview-content';
  // Extract first ~300 chars of text for preview (strip tags, take first paragraph)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = isiHTML;
  const firstParagraphs = tempDiv.querySelectorAll('p, .bodypara, li');
  let previewText = '';
  for (const p of firstParagraphs) {
    previewText += p.textContent.trim() + ' ';
    if (previewText.length > 200) break;
  }
  // Fallback: if no paragraphs, use raw text content
  if (!previewText.trim()) {
    previewText = tempDiv.textContent.trim().substring(0, 250);
  }
  previewContent.textContent = previewText.trim();

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

  function setExpanded(value) {
    expanded = value;
    block.classList.toggle('is-expanded', expanded);
    block.classList.toggle('is-collapsed', !expanded);
    previewContainer.hidden = expanded;
    expandContainer.hidden = !expanded;

    // Update all toggle buttons
    block.querySelectorAll('.sticky-isi-toggle').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(expanded));
      btn.setAttribute('aria-label', expanded ? 'Collapse safety information' : 'Expand safety information');
      const arrow = btn.querySelector('.sticky-isi-arrow');
      if (arrow) {
        arrow.className = `sticky-isi-arrow ${expanded ? 'arrow-down' : 'arrow-up'}`;
      }
    });

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

  // Initialize state
  block.classList.add('is-collapsed');
  setExpanded(false);

  // Defer auto-collapse setup to allow page to fully render
  if (document.readyState === 'complete') {
    setupAutoCollapse();
  } else {
    window.addEventListener('load', setupAutoCollapse, { once: true });
  }
}
