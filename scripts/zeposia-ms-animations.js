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
    // Remove existing slick classes (from source DOM) that interfere
    carousel.removeClass('slick-initialized slick-slider slick-dotted');
    carousel.find('.slick-slide').removeClass('slick-slide slick-current slick-active slick-cloned');
    carousel.find('.slick-list, .slick-track, .slick-dots').remove();

    // Init slick with source settings
    carousel.slick({
      dots: true,
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 5000,
      arrows: false,
      adaptiveHeight: true,
    });
  }
})();
