/**
 * Decorates the hero block.
 * For UC pages: splits "BREAK THE CYCLE WITH ZEPOSIA" into two styled lines
 * to match the legacy layout (regular weight line 1, bold line 2).
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const isUC = document.body.classList.contains('ucsite');
  if (!isUC) return;

  const h1 = block.querySelector('h1');
  if (!h1) return;

  const text = h1.textContent.trim();
  // Match the legacy structure: "BREAK THE CYCLE" (regular) + "WITH ZEPOSIA" (bold)
  const match = text.match(/^(BREAK THE CYCLE)\s+(WITH ZEPOSIA.*)$/i);
  if (match) {
    h1.innerHTML = `<span class="hero-line1">${match[1]}</span><br><strong class="hero-line2">${match[2]}</strong>`;
  }
}
