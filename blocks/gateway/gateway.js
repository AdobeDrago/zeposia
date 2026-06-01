/**
 * Gateway Block
 * Indication selector landing page with logo, HCP attestation, and CTA cards.
 * Includes HCP verification modal on first visit.
 */

function showHCPModal() {
  // Don't show if already verified this session
  if (sessionStorage.getItem('hcp-verified') === 'true') return;

  const overlay = document.createElement('div');
  overlay.className = 'gateway-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'gateway-modal-title');

  overlay.innerHTML = `
    <div class="gateway-modal">
      <h2 id="gateway-modal-title">Please verify that you are a U.S. Healthcare Professional</h2>
      <p>This information is intended for U.S. Healthcare Professionals.</p>
      <div class="gateway-modal-buttons">
        <div class="gateway-modal-choice">
          <span>I <b>am</b> a U.S. Healthcare Professional</span>
          <button type="button" class="gateway-modal-btn" data-action="confirm">Proceed to Site</button>
        </div>
        <div class="gateway-modal-choice">
          <span>I <b>am not</b> a U.S. Healthcare Professional</span>
          <a href="https://www.zeposia.com" class="gateway-modal-btn gateway-modal-btn-outline" data-action="deny">Return</a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent background scrolling
  document.body.style.overflow = 'hidden';

  // Delegated handler — survives any DOM shuffling and catches clicks on pseudo-elements / children
  overlay.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'confirm') {
      e.preventDefault();
      sessionStorage.setItem('hcp-verified', 'true');
      overlay.remove();
      document.body.style.overflow = '';
    }
    // deny: let the <a> navigate naturally
  });
}

export default function decorate(block) {
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Indication selector');

  // Authored rows are label/value pairs: top-header, logo, banner-text, uc-link, ms-link
  const ctaWrapper = document.createElement('div');
  ctaWrapper.className = 'gateway-ctas';

  [...block.children].forEach((row) => {
    const label = row.firstElementChild?.textContent.trim().toLowerCase();
    if (!label) return;
    row.firstElementChild.remove();

    if (label === 'top-header') row.classList.add('gateway-top-header');
    else if (label === 'logo') row.classList.add('gateway-logo');
    else if (label === 'banner-text') row.classList.add('gateway-description');
    else if (label === 'uc-link' || label === 'ms-link') {
      const link = row.querySelector('a');
      if (link) {
        link.classList.add('gateway-cta');
        link.setAttribute('aria-label', `View ${link.textContent.trim()} information`);
        const card = document.createElement('div');
        card.className = `gateway-cta-card gateway-cta-${label.split('-')[0]}`;
        card.append(link);
        ctaWrapper.append(card);
      }
      row.remove();
    }
  });

  if (ctaWrapper.children.length) block.append(ctaWrapper);

  showHCPModal();
}
