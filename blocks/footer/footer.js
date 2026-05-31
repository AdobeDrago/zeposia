/**
 * Footer Block — Zeposia HCP
 *
 * EDS pattern: loads authored fragment, parses structure, renders footer.
 * Expected fragment structure (authored in DA):
 *   - Row 1: Logo image (wrapped in link to bms.com)
 *   - Row 2: Utility nav links (pipe-separated or list)
 *   - Row 3+: Legal paragraphs (disclaimer, trademark, copyright + job code)
 */

function decorateExternalLinks(container) {
  const links = container.querySelectorAll('a[href]');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      const url = new URL(href, window.location.origin);
      if (url.hostname !== window.location.hostname) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.setAttribute('aria-label', `${link.textContent} (opens in a new tab)`);
      }
    }
  });
}

function buildLogo(logoImg) {
  const logoWrapper = document.createElement('div');
  logoWrapper.className = 'footer-logo';

  // Wrap logo in link to bms.com
  const logoLink = document.createElement('a');
  logoLink.href = 'https://www.bms.com';
  logoLink.target = '_blank';
  logoLink.rel = 'noopener noreferrer';
  logoLink.setAttribute('aria-label', 'Bristol Myers Squibb (opens in a new tab)');

  if (logoImg) {
    logoLink.appendChild(logoImg.cloneNode(true));
  }

  logoWrapper.appendChild(logoLink);
  return logoWrapper;
}

function buildNav(linksContainer) {
  const nav = document.createElement('nav');
  nav.className = 'footer-nav';
  nav.setAttribute('aria-label', 'Footer utility navigation');

  const ul = document.createElement('ul');
  ul.className = 'footer-nav-list';

  // Find all links in the fragment section
  const links = linksContainer.querySelectorAll('a');
  links.forEach((link) => {
    const li = document.createElement('li');
    const a = link.cloneNode(true);
    li.appendChild(a);
    ul.appendChild(li);
  });

  // Add privacy choices placeholder (OneTrust)
  const privacyLi = document.createElement('li');
  const privacyBtn = document.createElement('button');
  privacyBtn.className = 'footer-privacy-choices';
  privacyBtn.id = 'ot-sdk-btn';
  privacyBtn.textContent = 'Your Privacy Choices';
  privacyLi.appendChild(privacyBtn);

  // Insert after second item (Privacy Policy)
  if (ul.children.length >= 2) {
    ul.insertBefore(privacyLi, ul.children[2]);
  } else {
    ul.appendChild(privacyLi);
  }

  nav.appendChild(ul);
  return nav;
}

function buildLegal(paragraphs) {
  const legal = document.createElement('div');
  legal.className = 'footer-legal';

  paragraphs.forEach((p) => {
    const text = p.textContent.trim();
    if (!text) return;

    const div = document.createElement('div');

    if (text.startsWith('This site is intended')) {
      div.className = 'footer-disclaimer';
    } else if (text.includes('trademarks')) {
      div.className = 'footer-trademark';
    } else if (text.startsWith('©') || text.includes('Bristol-Myers Squibb Company')) {
      div.className = 'footer-copyright';
    } else {
      div.className = 'footer-legal-text';
    }

    div.innerHTML = p.innerHTML;
    legal.appendChild(div);
  });

  return legal;
}

export default async function decorate(block) {
  // In EDS, footer content is loaded as a fragment referenced by the block
  // The block element contains the authored content from the fragment
  const rows = [...block.children];
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'footer-wrapper';

  // Parse rows from fragment content
  let logoRow = null;
  let navRow = null;
  const legalParagraphs = [];

  rows.forEach((row) => {
    const img = row.querySelector('img');
    const links = row.querySelectorAll('a');
    const paragraphs = row.querySelectorAll('p');

    if (img && !logoRow) {
      // First row with an image is the logo
      logoRow = img;
    } else if (links.length > 2 && !navRow) {
      // Row with multiple links is the nav
      navRow = row;
    } else if (paragraphs.length > 0) {
      // Remaining paragraphs are legal text
      paragraphs.forEach((p) => legalParagraphs.push(p));
    }
  });

  // Build logo section
  if (logoRow) {
    wrapper.appendChild(buildLogo(logoRow));
  }

  // Build navigation
  if (navRow) {
    wrapper.appendChild(buildNav(navRow));
  }

  // Build legal section
  if (legalParagraphs.length > 0) {
    wrapper.appendChild(buildLegal(legalParagraphs));
  }

  // Decorate external links
  decorateExternalLinks(wrapper);

  block.appendChild(wrapper);
}
