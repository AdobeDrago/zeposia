/**
 * Gateway Block
 * Indication selector landing page with logo, HCP attestation, and CTA cards.
 * Minimal JS — mostly handled by CSS.
 */
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
}
