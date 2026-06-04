/**
 * ZEPOSIA MS template — delayed initialization
 * Loads jQuery + Slick carousel to match source page behavior.
 */

(async function initMSCarousel() {
  // Load jQuery
  if (!window.jQuery) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Load slick CSS
  const slickCSS = document.createElement('link');
  slickCSS.rel = 'stylesheet';
  slickCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css';
  document.head.appendChild(slickCSS);

  const slickThemeCSS = document.createElement('link');
  slickThemeCSS.rel = 'stylesheet';
  slickThemeCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css';
  document.head.appendChild(slickThemeCSS);

  // Load slick JS
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  // Remove our CSS carousel overrides that conflict with slick
  const fixesSheet = [...document.styleSheets].find(s => s.href?.includes('zeposia-ms-fixes'));
  if (fixesSheet) {
    const rules = [...fixesSheet.cssRules];
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i].selectorText?.includes('slick') || rules[i].selectorText?.includes('carousel-item')) {
        fixesSheet.deleteRule(i);
      }
    }
  }

  // Initialize slick on the carousel
  const $ = window.jQuery;
  const carousel = $('.carousel-container-body .carousel');
  if (carousel.length) {
        // Remove existing slick wrappers (they contain frozen state)
    carousel.removeClass('slick-initialized slick-slider slick-dotted');
    // Save any carousel-items before removing track
    carousel.find('.slick-list, .slick-track, .slick-dots, .slick-arrow').remove();
    // Items were inside slick-track and got removed - re-fetch from template
    const tplMeta = document.querySelector('meta[name=template]');
    if (tplMeta && carousel.find('.carousel-item').length === 0) {
      const resp = await fetch(window.hlx.codeBasePath + '/templates/' + tplMeta.content + '.html');
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const track = doc.querySelector('.slick-track');
      const items = track ? track.querySelectorAll('.carousel-item:not(.slick-cloned)') : [];
      items.forEach(item => {
        item.className = 'carousel-item';
        item.removeAttribute('style');
        item.removeAttribute('data-slick-index');
        item.removeAttribute('tabindex');
        item.removeAttribute('aria-hidden');
        carousel[0].appendChild(item.cloneNode(true));
      });
    }

    // Init slick with source settings
    carousel.slick({
      dots: true,
      infinite: true,
      speed: 5000,
      slidesToShow: 1,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 5000,
      arrows: false,
      adaptiveHeight: true,
    });

  }
})();
