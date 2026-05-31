/**
 * Header Block — ZEPOSIA HCP (EDS)
 *
 * Supports:
 * - Mega-menu / dropdown navigation (UC & MS variants)
 * - Brand logo with link
 * - Utility nav (PI PDF, Medication Guide, Patient Site, BMS Resources)
 * - Indication switcher modal trigger
 * - Mobile hamburger with slide-out panel
 * - Sticky/shrink on scroll
 * - Red "Start Form" CTA (MS only)
 * - Accessible: aria-expanded, keyboard nav, focus trap
 *
 * Indication detection: checks body or parent section for .uc / .ms class,
 * or infers from pathname (/ulcerative-colitis vs /multiple-sclerosis).
 */

const MOBILE_BREAKPOINT = 768;

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
 * Check if viewport is mobile.
 */
function isMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Build the hamburger toggle button.
 */
function createHamburger() {
  const btn = document.createElement('button');
  btn.className = 'header-hamburger';
  btn.setAttribute('aria-label', 'Toggle navigation menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'header-nav');
  btn.innerHTML = `
    <span class="hamburger-bar"></span>
    <span class="hamburger-bar"></span>
    <span class="hamburger-bar"></span>
  `;
  return btn;
}

/**
 * Parse the nav fragment content from the block's authored HTML.
 * EDS delivers the fragment as nested <ul>/<li> inside the block wrapper divs.
 * Structure:
 *   Section 0: Brand (logo image wrapped in link)
 *   Section 1: Primary nav (nested list)
 *   Section 2: Utility nav (flat list)
 */
function parseNavSections(block) {
  const sections = [];
  // EDS block content comes as direct child divs (rows), each with inner divs (cells)
  const rows = block.querySelectorAll(':scope > div');
  rows.forEach((row) => {
    sections.push(row);
  });
  return sections;
}

/**
 * Build dropdown behavior for a nav item with nested <ul>.
 */
function setupDropdown(li) {
  const nestedUl = li.querySelector(':scope > ul');
  if (!nestedUl) return;

  li.classList.add('header-nav-dropdown');
  const toggle = li.querySelector(':scope > a') || li.firstElementChild;

  // Add dropdown arrow indicator
  const arrow = document.createElement('span');
  arrow.className = 'dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  toggle.appendChild(arrow);

  // Wrap nested ul for styling
  nestedUl.classList.add('header-dropdown-menu');
  nestedUl.setAttribute('role', 'menu');

  // Set ARIA attributes
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-haspopup', 'true');

  // Desktop: hover + click toggle
  const open = () => {
    li.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    li.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  // Mouse events (desktop)
  li.addEventListener('mouseenter', () => { if (!isMobile()) open(); });
  li.addEventListener('mouseleave', () => { if (!isMobile()) close(); });

  // Click/tap toggle (mobile + desktop fallback)
  toggle.addEventListener('click', (e) => {
    if (toggle.getAttribute('href') === '#' || isMobile()) {
      e.preventDefault();
      if (li.classList.contains('is-open')) {
        close();
      } else {
        // Close siblings
        li.parentElement.querySelectorAll('.header-nav-dropdown.is-open').forEach((sib) => {
          if (sib !== li) {
            sib.classList.remove('is-open');
            sib.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
          }
        });
        open();
      }
    }
  });

  // Keyboard: Enter/Space to toggle, Escape to close
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (toggle.getAttribute('href') === '#') {
        e.preventDefault();
        toggle.click();
      }
    }
    if (e.key === 'Escape') {
      close();
      toggle.focus();
    }
  });

  // Escape inside dropdown returns focus to toggle
  nestedUl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      toggle.focus();
    }
  });
}

/**
 * Identify and style the CTA button (bold link = "Start Form" in MS).
 */
function setupCTA(navList) {
  // In EDS authored content, bold links render as <strong><a> or <a><strong>
  navList.querySelectorAll('li').forEach((li) => {
    const strong = li.querySelector('strong');
    if (strong) {
      li.classList.add('header-nav-cta');
      const link = strong.querySelector('a') || li.querySelector('a');
      if (link) {
        link.classList.add('header-cta-button');
      }
    }
  });
}

/**
 * Setup indication switcher trigger.
 * Links with href containing "#indications" or text "Indications" trigger a custom event.
 */
function setupIndicationSwitcher(container) {
  container.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = a.textContent.trim().toLowerCase();
    if (href.includes('#indications') || href.includes('#indication') || text === 'indications') {
      a.classList.add('header-indication-trigger');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('zeposia:indication-switcher', {
          detail: { trigger: a },
        }));
        // Fallback: toggle a modal class on body
        document.body.classList.toggle('indication-modal-open');
      });
    }
  });
}

/**
 * Setup BMS Resources trigger (opens overlay panel).
 */
function setupBMSResources(container) {
  container.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = a.textContent.trim().toLowerCase();
    if (href.includes('#bms-resources') || text === 'bms resources') {
      a.classList.add('header-bms-resources-trigger');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('zeposia:bms-resources', {
          detail: { trigger: a },
        }));
      });
    }
  });
}

/**
 * Setup external link indicators.
 */
function setupExternalLinks(container) {
  container.querySelectorAll('a[href^="http"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && !href.includes(window.location.hostname)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.classList.add('header-external-link');
    }
  });
}

/**
 * Focus trap for mobile menu.
 */
function trapFocus(container, isActive) {
  if (!isActive) return;
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/**
 * Sticky header with shrink behavior on scroll.
 */
function setupStickyScroll(header) {
  let ticking = false;
  const SCROLL_THRESHOLD = 50;

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > SCROLL_THRESHOLD) {
          header.classList.add('header-scrolled');
        } else {
          header.classList.remove('header-scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

/**
 * Main decorate function — EDS block entry point.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const indication = getIndication();
  block.classList.add(`header-${indication}`);

  // Parse authored content sections
  const rows = [...block.querySelectorAll(':scope > div')];

  // Build header structure
  const headerWrapper = document.createElement('div');
  headerWrapper.className = 'header-wrapper';

  // --- Brand Section ---
  const brandSection = document.createElement('div');
  brandSection.className = 'header-brand';

  // Find logo: first picture/img in the block
  const logoImg = block.querySelector('picture, img');
  if (logoImg) {
    const logoLink = document.createElement('a');
    logoLink.href = indication === 'ms' ? '/multiple-sclerosis' : '/ulcerative-colitis';
    logoLink.className = 'header-logo-link';
    logoLink.setAttribute('aria-label', 'ZEPOSIA® (ozanimod) — Home');
    const logoClone = logoImg.cloneNode(true);
    logoLink.appendChild(logoClone);
    brandSection.appendChild(logoLink);
  }

  // --- Primary Nav ---
  const navSection = document.createElement('nav');
  navSection.className = 'header-nav';
  navSection.id = 'header-nav';
  navSection.setAttribute('aria-label', 'Main navigation');

  // Find the primary nav list (first <ul> after the logo area)
  const allLists = block.querySelectorAll('ul');
  let primaryList = null;
  let utilityList = null;

  if (allLists.length >= 2) {
    primaryList = allLists[0];
    utilityList = allLists[1];
  } else if (allLists.length === 1) {
    primaryList = allLists[0];
  }

  if (primaryList) {
    const navClone = primaryList.cloneNode(true);
    navClone.className = 'header-nav-list';
    navClone.setAttribute('role', 'menubar');

    // Setup dropdowns for items with nested <ul>
    navClone.querySelectorAll(':scope > li').forEach((li) => {
      li.setAttribute('role', 'none');
      const link = li.querySelector(':scope > a');
      if (link) link.setAttribute('role', 'menuitem');
      setupDropdown(li);
    });

    // Setup CTA buttons (bold links like "Start Form")
    setupCTA(navClone);

    navSection.appendChild(navClone);
  }

  // --- Utility Nav ---
  const utilitySection = document.createElement('div');
  utilitySection.className = 'header-utility';

  if (utilityList) {
    const utilClone = utilityList.cloneNode(true);
    utilClone.className = 'header-utility-list';
    setupExternalLinks(utilClone);
    setupIndicationSwitcher(utilClone);
    setupBMSResources(utilClone);
    utilitySection.appendChild(utilClone);
  }

  // --- Hamburger ---
  const hamburger = createHamburger();

  // --- Mobile Overlay ---
  const mobileOverlay = document.createElement('div');
  mobileOverlay.className = 'header-mobile-overlay';
  mobileOverlay.setAttribute('aria-hidden', 'true');

  // Hamburger toggle behavior
  hamburger.addEventListener('click', () => {
    const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!isExpanded));
    block.classList.toggle('header-mobile-open');
    navSection.classList.toggle('is-open');
    mobileOverlay.setAttribute('aria-hidden', String(isExpanded));
    document.body.classList.toggle('nav-open');

    if (!isExpanded) {
      trapFocus(navSection, true);
      // Focus first nav item
      const firstLink = navSection.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  });

  // Close mobile nav on overlay click
  mobileOverlay.addEventListener('click', () => {
    hamburger.click();
  });

  // Close mobile nav on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && block.classList.contains('header-mobile-open')) {
      hamburger.click();
    }
  });

  // --- Assemble ---
  headerWrapper.appendChild(utilitySection);

  const mainBar = document.createElement('div');
  mainBar.className = 'header-main-bar';
  mainBar.appendChild(brandSection);
  mainBar.appendChild(navSection);
  mainBar.appendChild(hamburger);

  headerWrapper.appendChild(mainBar);
  headerWrapper.appendChild(mobileOverlay);

  // Clear block and insert new structure
  block.textContent = '';
  block.appendChild(headerWrapper);

  // Setup sticky/scroll
  setupStickyScroll(block);

  // Setup triggers in the assembled DOM
  setupExternalLinks(navSection);
  setupIndicationSwitcher(navSection);
  setupBMSResources(navSection);

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) {
      block.querySelectorAll('.header-nav-dropdown.is-open').forEach((li) => {
        li.classList.remove('is-open');
        li.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Handle resize: close mobile menu if resizing to desktop
  window.addEventListener('resize', () => {
    if (!isMobile() && block.classList.contains('header-mobile-open')) {
      hamburger.setAttribute('aria-expanded', 'false');
      block.classList.remove('header-mobile-open');
      navSection.classList.remove('is-open');
      mobileOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-open');
    }
  });
}
