import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/* =====================================================================
   STATIC-TO-EDS OVERLAY ENGINE

   See experiments/knowledge/architecture.md for the design.

   Flow:
     1. Page loads — main contains DA-authored block tables.
     2. readBlockSlots() captures slot data from the current DOM.
     3. fetch /templates/<template-name>.html — the original static
        page's <main> structure with [data-slot] markers.
     4. applySlotsToTemplate() writes slot content into the template.
     5. main.innerHTML is replaced with the populated template.
     6. Standard EDS decoration is skipped on overlay-controlled main.
   ===================================================================== */

/**
 * Read block-table content from a DA-shaped main element.
 * Block layout (post-pipeline):
 *   main > div(section) > div.blockname > div(row) > div(cell)
 * Returns { blockClassName: { slotName: htmlString, ... } }.
 */
function readBlockSlots(main) {
  const slots = {};
  main.querySelectorAll(':scope > div > div').forEach((block) => {
    const blockName = block.className.trim().split(/\s+/)[0];
    if (!blockName) return;
    slots[blockName] = slots[blockName] || {};
    block.querySelectorAll(':scope > div').forEach((row) => {
      const cells = row.querySelectorAll(':scope > div');
      if (cells.length >= 2) {
        const name = cells[0].textContent.trim();
        if (name) slots[blockName][name] = cells[1].innerHTML.trim();
      }
    });
  });
  return slots;
}

/**
 * Parse an HTML fragment string and return the first matching element,
 * or null if none. Used to lift element-typed values out of DA cells.
 */
function parseFirst(value, selector) {
  const tmp = document.createElement('div');
  tmp.innerHTML = value;
  return tmp.querySelector(selector);
}

/**
 * Write a slot value into a template element. Behavior is element-typed.
 */
function writeSlot(el, value) {
  const { tagName } = el;
  if (tagName === 'IMG') {
    const img = parseFirst(value, 'img');
    if (img) {
      el.src = img.getAttribute('src');
      if (img.alt) el.alt = img.alt;
    }
    return;
  }
  if (tagName === 'PICTURE') {
    const newPic = parseFirst(value, 'picture');
    if (newPic) el.replaceWith(newPic);
    return;
  }
  // Background-image slots on <a> must be handled before the link branch —
  // otherwise the link writer replaces the inner tile structure with just
  // the DA cell's <img>, wiping nested [data-slot] children (e.g. tile labels).
  if (tagName === 'A' && !(el.style && el.style.backgroundImage)) {
    const a = parseFirst(value, 'a');
    if (a) {
      el.href = a.getAttribute('href');
      el.innerHTML = a.innerHTML;
    } else {
      el.innerHTML = value;
    }
    return;
  }
  // Background-image slot: target element has an inline
  // style="background-image:url(...)". DA cell carries an <img>;
  // extract its src and replace just the background-image URL,
  // preserving any other inline styles on the element. Lets pages
  // with CSS-driven photos (hero backdrops, card tiles where the
  // image is the container's background) expose those images as DA
  // slots without restructuring source markup.
  if (el.style && el.style.backgroundImage) {
    const img = parseFirst(value, 'img');
    if (img) {
      const newSrc = img.getAttribute('src');
      // Double-quote — URLs more commonly contain ' than " (which
      // would have to be percent-encoded), so " is the safer wrap.
      el.style.backgroundImage = `url("${newSrc}")`;
    }
    return;
  }
  // Heading slots: if the DA cell value is wrapped in a same-tag heading
  // (e.g. <h1>...</h1> for a <h1 data-slot>), setting innerHTML directly
  // triggers the browser's auto-close — the parser ends the outer <h1>
  // before opening the inner one, producing an empty template <h1>
  // followed by an orphaned <h1> sibling. Unwrap the inner heading's
  // content and use that as innerHTML to keep a single clean heading.
  if (/^H[1-6]$/.test(tagName)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = value;
    const inner = tmp.querySelector(tagName.toLowerCase());
    el.innerHTML = inner ? inner.innerHTML : value;
    return;
  }
  // Default: text / inline-HTML slot
  el.innerHTML = value;
}

/**
 * Walk template sections, match each section's first class to a block
 * in `slots`, and write slot values into [data-slot] markers.
 */
function applySlotsToTemplate(templateMain, slots) {
  // Pass 1: section-based slot filling (original mechanism)
  templateMain.querySelectorAll('section[class]').forEach((section) => {
    const blockName = section.className.trim().split(/\s+/)[0];
    const blockSlots = slots[blockName];
    if (!blockSlots) return;
    section.querySelectorAll('[data-slot]').forEach((el) => {
      const slotName = el.getAttribute('data-slot');
      if (slotName in blockSlots) { writeSlot(el, blockSlots[slotName]); el.setAttribute('data-slot-filled', '1'); }
    });
  });
  // Pass 2: global fallback for data-slot elements outside sections
  const allSlotValues = {};
  Object.values(slots).forEach((blockSlots) => Object.assign(allSlotValues, blockSlots));
  templateMain.querySelectorAll('[data-slot]:not([data-slot-filled])').forEach((el) => {
    const slotName = el.getAttribute('data-slot');
    if (slotName in allSlotValues) writeSlot(el, allSlotValues[slotName]);
  });
}

/**
 * Resolve the template name from page metadata, body[data-template], or
 * null if no overlay applies.
 */
function resolveTemplateName() {
  const meta = getMetadata('template');
  if (meta) return meta;
  return document.body.getAttribute('data-template') || null;
}

/**
 * Apply the static-page overlay to main.
 * Returns true if the overlay ran, false otherwise.
 */
async function applyTemplateOverlay(main) {
  const templateName = resolveTemplateName();
  if (!templateName) return false;

  const slots = readBlockSlots(main);
 window._daSlots = slots;
 window._daSlots = slots;

  // Load template-scoped CSS in parallel with the template HTML so
  // styles arrive before body.appear paints. `head.html` no longer
  // hardcodes a per-template stylesheet  each template ships its
  // own at /styles/<template>.css.
  const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/styles/${templateName}.css`);

  const resp = await fetch(`${window.hlx.codeBasePath}/templates/${templateName}.html`);
  if (!resp.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[overlay] template not found: ${templateName}`);
    return false;
  }
  const templateHtml = await resp.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${templateHtml}</body></html>`, 'text/html');
  const newMain = doc.body.querySelector('main');
  if (!newMain) {
    // eslint-disable-next-line no-console
    console.warn(`[overlay] template "${templateName}" has no <main>`);
    return false;
  }

  // Lift any top-level <link> resources the template declares into
  // <head>. Lets a template self-describe its head needs (font
  // preconnects, Google Fonts stylesheet, etc) without forcing those
  // links into the shared head.html for every page. Dedupe by the
  // resolved href + rel string so a template doesn't double-load a
  // resource that head.html already brings in.
  const existingLinks = [...document.head.querySelectorAll('link')];
  doc.body.querySelectorAll(':scope > link').forEach((link) => {
    const clone = link.cloneNode(true);
    if (existingLinks.some((l) => l.href === clone.href && l.rel === clone.rel)) return;
    document.head.appendChild(clone);
    existingLinks.push(clone);
  });

  applySlotsToTemplate(newMain, slots);

  main.innerHTML = newMain.innerHTML;
  main.dataset.overlay = templateName;

  // Add body classes based on template for source CSS compatibility
  const templateBodyClasses = {
    "zeposia-uc": ["ucsite", "uc-home", "disabled"],
    "zeposia-ms": ["mssite", "ms-home", "disabled"],
    "zeposia-ms-support": ["mssite", "ms-support", "disabled"],
    "zeposia-ms-additional-studies": ["mssite", "ms-tk", "disabled"],
    "zeposia-ms-safety": ["mssite", "ms-safety", "disabled"],
    "zeposia-gateway": ["gateway-page"],
    "uc-clinical-data": ["ucsite", "uc-home", "disabled"],
    "zeposia-ms-efficacy": ["mssite", "ms-efficacy", "disabled"],
    "zeposia-ms-study-design": ["mssite", "ms-studydesign", "disabled"],
    "zeposia-ms-getting-started": ["mssite", "ms-gettingstarted", "disabled"],
    "zeposia-ms-moa": ["mssite", "ms-moa", "disabled"],
    "uc-efficacy": ["ucsite", "uc-home", "disabled"],
    "uc-study-design": ["ucsite", "uc-studydesign", "disabled"],
    "uc-safety": ["ucsite", "uc-safety", "disabled"],
  };
  const bodyClasses = templateBodyClasses[templateName];
  if (bodyClasses) bodyClasses.forEach((cls) => document.body.classList.add(cls));

  // Inject critical CSS overrides that must win over imported source stylesheets
  const overrideStyle = document.createElement("style");
  overrideStyle.textContent = `
  .grey-con .flx-ban, .left-banner .flx-ban, .flx-ban { display: flex !important; flex-wrap: nowrap !important; }
  .banner-info.ucs_home { padding: 0 !important; width: 0 !important; overflow: hidden !important; }
  main > .isi-rendering.aem-GridColumn { display: none !important; height: 0 !important; }
.card-color-container { max-height: 539px !important; overflow: hidden !important; }
.left-banner > .footenote-container { max-height: 165px !important; overflow: hidden !important; }
.bann_big { max-height: 76px !important; overflow: hidden !important; }
main > .experiencefragment.section { display: none !important; }
main > .column-control.aem-GridColumn { max-height: 3538px !important; overflow: hidden !important; }
  `;
  document.head.appendChild(overrideStyle);
    
  await cssLoaded;
  return true;
}

/* =====================================================================
   Boilerplate decoration kept for non-overlay pages
   ===================================================================== */

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    if (h1.closest('.hero') || picture.closest('.hero')) return;
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

function buildAutoBlocks(main) {
  try {
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();
    if (a.querySelector('img') || p.textContent.trim() !== text) return;
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;
    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) {
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  // Path-based body classes + styles for native EDS pages (replaces overlay-injected classes)
  const path = window.location.pathname;
  if (path.startsWith('/ulcerative-colitis')) {
    document.body.classList.add('ucsite');
    loadCSS(`${window.hlx.codeBasePath}/styles/zeposia-uc-native.css`);
    // Load self-hosted source CSS for pixel-perfect rendering
    if (path === '/ulcerative-colitis' || path === '/ulcerative-colitis/') {
      document.body.classList.add('uc-home');
      document.body.classList.add('disabled');
    }
  } else if (path.startsWith('/multiple-sclerosis')) {
    document.body.classList.add('mssite');
  }

  const main = doc.querySelector('main');
  if (!main) return;

  const overlayApplied = await applyTemplateOverlay(main);
  if (overlayApplied) {
    // Overlay-controlled main: template provides its own structure and
    // styles. Skip EDS section/block decoration to preserve the
    // original DOM exactly as the static page intended.
    document.body.classList.add('appear');
  } else {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

async function loadLazy(doc) {
  const main = doc.querySelector('main');

  if (!main.dataset.overlay) {
    loadHeader(doc.querySelector('header'));
    loadFooter(doc.querySelector('footer'));
    await loadSections(main);
  }

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
}

// Document-level HCP modal handler  fires regardless of script timing
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.hcp_btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const modal = document.getElementById('entryModal');
    if (modal) {
      modal.classList.add('hcp-dismissed');
      modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    sessionStorage.setItem('hcp-verified', 'true');
  }
});

function initHCPModal() {
  const modal = document.getElementById('entryModal');
  if (!modal) return;

  if (sessionStorage.getItem('hcp-verified') === 'true') {
    modal.classList.add('hcp-dismissed');
    modal.style.display = 'none';
    return;
  }

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  window.scrollTo(0, 0);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  initHCPModal();
  loadDelayed();
}

loadPage();

// Indications popup: show once, close button, localStorage persistence
(function() {
  const KEY = 'zeposia_ind_seen';
  function setup() {
    const modal = document.getElementById('indication_modal');
    if (!modal) return false;
    if (localStorage.getItem(KEY)) {
      modal.style.display = 'none';
      return true;
    }
    modal.style.display = 'block';
    modal.classList.add('show');
    const close = modal.querySelector('.btn-close') || modal.querySelector('[class*=close]');
    if (close) {
      close.style.cursor = 'pointer';
      close.addEventListener('click', () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        localStorage.setItem(KEY, '1');
      });
    }
    // Nav link toggle
    document.querySelectorAll('#nav-ind-m, .nav-indlink').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const vis = modal.style.display !== 'none';
        modal.style.display = vis ? 'none' : 'block';
        if (vis) localStorage.setItem(KEY, '1');
      });
    });
    return true;
  }
  // Retry until modal exists (overlay may not have finished)
  let attempts = 0;
  const interval = setInterval(() => {
    if (setup() || ++attempts > 20) clearInterval(interval);
  }, 250);
})();

// Tab switching for efficacy page (and any page with .tab-switch + .page-section)
(function initTabs() {
  function setup() {
    const sections = document.querySelectorAll('.color-box.highlight-section, [id=week10], [id=week52], [id=ole-study]');
    if (!sections.length) return false;
    let bound = false;
    sections.forEach(section => {
      const tabs = section.querySelectorAll('.tab-switch');
      const panels = section.querySelectorAll('.page-section');
      if (tabs.length === 0 || panels.length === 0) return;
      tabs.forEach((tab, idx) => {
        tab.style.cursor = 'pointer';
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          panels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
          tab.classList.add('active');
          if (panels[idx]) { panels[idx].classList.add('active'); panels[idx].style.display = 'block'; }
        });
        bound = true;
      });
    });
    // Smooth scroll for nav-link anchors
    document.querySelectorAll('a.nav-link[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
      });
    });
    return bound;
  }
  let attempts = 0;
  const interval = setInterval(() => {
    if (setup() || ++attempts > 20) clearInterval(interval);
  }, 250);
})();

// Sticky second-level navigation bar (#jumpLinkBar)
// On pages with a .showTop > .transparent-ms#jumpLinkBar, the nav should stick
// to the top when the user scrolls past it (replicates original site behavior
// via .fixedNavMS class which triggers position:fixed in source CSS).
(function initStickySubNav() {
  function setup() {
    var bar = document.getElementById('jumpLinkBar');
    if (!bar) return false;
    var showTop = bar.closest('.showTop');
    if (!showTop) return false;

    // Calculate the bar's natural offset from the top of the document
    var barOffsetTop = 0;
    function recalcOffset() {
      // Temporarily remove fixed positioning to get natural position
      var wasFixed = bar.classList.contains('fixedNavMS');
      if (wasFixed) bar.classList.remove('fixedNavMS');
      barOffsetTop = bar.getBoundingClientRect().top + window.pageYOffset;
      if (wasFixed) bar.classList.add('fixedNavMS');
    }
    recalcOffset();

    // Create a placeholder to prevent content jump when nav becomes fixed
    var placeholder = document.createElement('div');
    placeholder.id = 'jumpLinkBar-placeholder';
    placeholder.style.cssText = 'display:none;height:' + bar.offsetHeight + 'px;';
    bar.parentNode.insertBefore(placeholder, bar.nextSibling);

    var isSticky = false;

    function onScroll() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollY >= barOffsetTop && !isSticky) {
        bar.classList.add('fixedNavMS');
        placeholder.style.display = 'block';
        isSticky = true;
      } else if (scrollY < barOffsetTop && isSticky) {
        bar.classList.remove('fixedNavMS');
        placeholder.style.display = 'none';
        isSticky = false;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Handle resize (recalculate offset)
    window.addEventListener('resize', function() {
      if (isSticky) {
        bar.classList.remove('fixedNavMS');
        placeholder.style.display = 'none';
        isSticky = false;
      }
      recalcOffset();
      placeholder.style.height = bar.offsetHeight + 'px';
      onScroll();
    });

    // Also handle smooth scrolling for the nav links with hash offset
    bar.querySelectorAll('a.nav-link[href^="#"]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        var targetId = link.getAttribute('href').substring(1);
        var target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          var barHeight = bar.offsetHeight;
          var targetTop = target.getBoundingClientRect().top + window.pageYOffset - barHeight - 10;
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      });
    });

    // Run once on load in case page is already scrolled (e.g. hash in URL)
    onScroll();

    // Handle initial hash navigation with offset
    if (window.location.hash) {
      setTimeout(function() {
        var targetId = window.location.hash.substring(1);
        var target = document.getElementById(targetId);
        if (target) {
          var barHeight = bar.offsetHeight;
          var targetTop = target.getBoundingClientRect().top + window.pageYOffset - barHeight - 10;
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }, 500);
    }

    return true;
  }

  var attempts = 0;
  var interval = setInterval(function() {
    if (setup() || ++attempts > 30) clearInterval(interval);
  }, 300);
})();


// Global: Request a Rep chat popup (injects on all pages)
// Fixed: Uses unique ID 'rar-popup-window' to avoid CSS conflicts with
// rarChatbotPageLoad.css which sets visibility:hidden and clip-path on #chat-window.
(function() {
  var POPUP_ID = 'rar-popup-window';

  function setup() {
    var triggers = document.querySelectorAll('#open-converse, img[alt*="Request a Rep"], img[src*="request-rep"]');
    if (!triggers.length) return false;

    // Remove the original template #chat-window (conflicts with chatbot CSS)
    var oldChatWindow = document.getElementById('chat-window');
    if (oldChatWindow) oldChatWindow.remove();

    // Also remove #chat-bot container if present (from template, non-functional here)
    var chatBot = document.getElementById('chat-bot');
    if (chatBot) chatBot.remove();

    // Create our popup with a unique ID that won't be targeted by chatbot CSS
    var popup = document.getElementById(POPUP_ID);
    if (!popup) {
      popup = document.createElement('div');
      popup.id = POPUP_ID;
      popup.style.cssText = 'position:fixed;right:60px;top:200px;width:320px;max-height:500px;z-index:10000;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:none;overflow:auto;font-family:Montserrat,sans-serif;visibility:visible;clip-path:none;opacity:1;';
      popup.innerHTML = '<div style="background:#0054a6;color:#fff;padding:12px 15px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between"><div style="font-weight:bold;font-size:15px">Request a Rep</div><div><span class="rar-popup-close" style="cursor:pointer;color:#fff;font-size:18px">&#10005;</span></div></div><div style="padding:20px"><p style="margin:0 0 12px;font-size:13px;line-height:1.5">Before we begin, please know that all conversations are recorded for quality purposes.</p><p style="margin:0 0 12px;font-size:13px;line-height:1.5">This chat feature is intended for healthcare professionals (HCPs).</p><p style="margin:0 0 12px;font-size:13px;line-height:1.5">I cannot provide medical advice. Please consult your healthcare provider for medical guidance.</p><p style="margin:0 0 12px;font-size:11px;line-height:1.4"><b>Terms:</b> When you interact with this BMS chat feature, any personal information collected is governed by our <a href="https://www.bms.com/privacy-policy.html" target="_blank" style="color:#0054a6">Privacy Notice</a> which may be updated periodically.</p><p style="margin:0 0 12px;font-size:11px;line-height:1.4">To learn more or exercise your rights, visit the <a href="https://www.bms.com/privacy-policy.html" target="_blank" style="color:#0054a6">Privacy Notice Center</a>.</p><div style="margin-top:15px;display:flex;gap:10px"><button class="rar-popup-accept" style="background:#0054a6;color:#fff;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px">Accept</button><button class="rar-popup-decline" style="background:#fff;color:#0054a6;border:1px solid #0054a6;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px">Decline</button></div></div>';
      document.body.appendChild(popup);

      // Close button
      popup.querySelector('.rar-popup-close').addEventListener('click', function() {
        popup.style.display = 'none';
      });
      // Decline button
      popup.querySelector('.rar-popup-decline').addEventListener('click', function() {
        popup.style.display = 'none';
      });
      // Accept button (placeholder – can be wired to real chat in future)
      popup.querySelector('.rar-popup-accept').addEventListener('click', function() {
        popup.querySelector('.rar-popup-accept').textContent = 'Connecting...';
        popup.querySelector('.rar-popup-accept').disabled = true;
      });
    }

    triggers.forEach(function(btn) {
      btn.removeAttribute('onclick');
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
      });
    });

    return true;
  }
  var attempts = 0;
  var interval = setInterval(function() { if (setup() || ++attempts > 30) clearInterval(interval); }, 300);
})();

// Dropdown menus: toggle on click (Bootstrap dropdowns without Bootstrap JS)
(function() {
  function setup() {
    var toggles = document.querySelectorAll('.dropdown-toggle');
    if (!toggles.length) return false;
    toggles.forEach(function(toggle) {
      var parent = toggle.closest('.dropdown') || toggle.parentElement;
      var menu = parent.querySelector('.dropdown-menu');
      if (!menu) return;
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = menu.classList.contains('show');
        document.querySelectorAll('.dropdown-menu.show').forEach(function(m) { m.classList.remove('show'); });
        if (!isOpen) menu.classList.add('show');
      });
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(function(m) { m.classList.remove('show'); });
      }
    });
    return true;
  }
  var attempts = 0;
  var interval = setInterval(function() { if (setup() || ++attempts > 30) clearInterval(interval); }, 300);
})();

/**
 * Map EDS DOM elements to source CSS classes for pixel-perfect rendering.
 * This adds classes that the self-hosted source CSS targets.
 */

/**
 * Transform EDS DOM to source-equivalent structure for pixel-perfect CSS rendering.
 * Runs after page decoration. Converts semantic HTML (p, strong, ul, li) to 
 * source-style DOM (div.bodypara, span.head3, ul.indication-li, li.bodypara).
 */
function transformToSourceDOM() {
  const path = window.location.pathname;
  if (!path.startsWith('/ulcerative-colitis')) return;

  // Transform ISI fragment content
  const fragWrapper = document.querySelector('.fragment-wrapper');
  if (fragWrapper) {
    const content = fragWrapper.querySelector('.fragment');
    if (content) {
      // Transform all <p> to <div class="bodypara">
      content.querySelectorAll('p').forEach(p => {
        const div = document.createElement('div');
        div.className = 'bodypara';
        div.innerHTML = p.innerHTML;
        p.replaceWith(div);
      });
      
      // Transform <h3> to <div class="head3">
      content.querySelectorAll('h3').forEach(h3 => {
        const div = document.createElement('div');
        div.className = 'head3';
        if (h3.id) div.id = h3.id;
        div.innerHTML = h3.innerHTML;
        h3.replaceWith(div);
      });
      
      // Transform <h2> to <div class="head3 newhead-uc">  
      content.querySelectorAll('h2').forEach(h2 => {
        const div = document.createElement('div');
        div.className = 'head3 newhead-uc';
        div.innerHTML = h2.innerHTML;
        h2.replaceWith(div);
      });
      
      // Transform <strong> inside .bodypara to <span class="head3">
      content.querySelectorAll('.bodypara > strong:first-child').forEach(strong => {
        const span = document.createElement('span');
        span.className = 'head3';
        span.innerHTML = strong.innerHTML;
        // Move the remaining text after the span
        const parent = strong.parentElement;
        strong.replaceWith(span);
      });
      
      // Add indication-li class to ULs
      content.querySelectorAll('ul').forEach(ul => {
        ul.classList.add('indication-li');
      });
      
      // Add bodypara class to LIs
      content.querySelectorAll('li').forEach(li => {
        li.classList.add('bodypara');
      });
      
      // Wrap content in ISI structure
      fragWrapper.classList.add('cmp-footer-isi-content-element');
      content.classList.add('isi-content');
    }
  }
  
  // Transform clinical section
  const sections = document.querySelectorAll('main > .section');
  if (sections[1]) {
    const wrapper = sections[1].querySelector('.default-content-wrapper');
    if (wrapper) {
      // Add source container classes
      sections[1].classList.add('column-control');
      wrapper.classList.add('home-content', 'container', 'ptop200');
      
      // Wrap paragraphs in secondPara div
      const secondPara = document.createElement('div');
      secondPara.className = 'secondPara';
      while (wrapper.firstChild) {
        secondPara.appendChild(wrapper.firstChild);
      }
      wrapper.appendChild(secondPara);
      
      // Transform <strong> to <span class="blue bold">
      secondPara.querySelectorAll('p strong').forEach(strong => {
        const span = document.createElement('span');
        span.className = 'blue bold';
        span.innerHTML = strong.innerHTML;
        strong.replaceWith(span);
      });
    }
  }
  
  // Transform hero section
  if (sections[0]) {
    const hero = sections[0].querySelector('.hero');
    if (hero) {
      hero.classList.add('left-banner');
      // Add banner-content wrapper
      const innerDiv = hero.querySelector(':scope > div > div');
      if (innerDiv) {
        innerDiv.classList.add('banner-content', 'contentBlock');
      }
    }
  }
}

// Run after all blocks are loaded
if (document.readyState === 'complete') {
  setTimeout(transformToSourceDOM, 3000);
} else {
  window.addEventListener('load', () => setTimeout(transformToSourceDOM, 3000));
}

