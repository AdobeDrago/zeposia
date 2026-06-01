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
          <button class="gateway-modal-btn" data-action="confirm">Proceed to Site</button>
        </div>
        <div class="gateway-modal-choice">
          <span>I <b>am not</b> a U.S. Healthcare Professional</span>
          <a href="https://www.zeposia.com" class="gateway-modal-btn" data-action="deny">Return</a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent background scrolling
  document.body.style.overflow = 'hidden';

  // Handle confirm button
  const confirmBtn = overlay.querySelector('[data-action="confirm"]');
  confirmBtn.addEventListener('click', () => {
    sessionStorage.setItem('hcp-verified', 'true');
    overlay.remove();
    document.body.style.overflow = '';
  });

  // The deny button is an <a> tag that navigates away, no extra handler needed
}

export default function decorate(block) {
  // Add aria-label for accessibility
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Indication selector');

  // Mark the CTA row for card styling
  const rows = [...block.children];
  if (rows.length >= 3) {
    rows[0].classList.add('gateway-logo');
    rows[1].classList.add('gateway-description');
    rows[2].classList.add('gateway-ctas');

    // Add arrow icons to CTA links
    const ctaLinks = rows[2].querySelectorAll('a');
    ctaLinks.forEach((link) => {
      link.classList.add('gateway-cta');
      link.setAttribute('aria-label', `View ${link.textContent.trim()} information`);
    });
  }

  // Show HCP verification modal
  showHCPModal();
}
