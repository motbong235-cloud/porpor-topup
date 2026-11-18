// Entrance animation controller — adds `.is-visible` to `.entrance-animate` elements when they enter the viewport.
(function () {
  'use strict';

  function initEntrance() {
    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.entrance-animate').forEach(el => el.classList.add('is-visible'));
      return;
    }

    const elements = Array.from(document.querySelectorAll('.entrance-animate'));
    if (!elements.length) return;

    // IntersectionObserver options: trigger shortly before element fully appears
    const ioOptions = { root: null, threshold: 0.12, rootMargin: '0px 0px -6% 0px' };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          const el = entry.target;
          if (entry.isIntersecting) {
            // Use rAF to avoid layout thrash when toggling class
            window.requestAnimationFrame(() => el.classList.add('is-visible'));
            // default: animate once. To opt-out, add data-animate-once="false"
            if (el.dataset.animateOnce !== 'false') obs.unobserve(el);
          }
        });
      }, ioOptions);

      elements.forEach(el => io.observe(el));
    } else {
      // Fallback: show all immediately
      elements.forEach(el => el.classList.add('is-visible'));
    }
  }

  // Wait until main UI components (slider, marquee) finish initializing.
  // Slider uses window.load; marquee builds during DOMReady — waiting for load ensures both are ready.
  if (document.readyState === 'complete') {
    initEntrance();
  } else {
    window.addEventListener('load', () => {
      // small delay so load handlers (slider/marquee) finish their work
      setTimeout(initEntrance, 20);
    }, { once: true });

    // SPA navigation / pageshow fallback (e.g. bfcache restore)
    window.addEventListener('pageshow', (ev) => {
      if (ev.persisted) {
        // re-init / re-check elements to ensure entrance animations still work
        setTimeout(initEntrance, 20);
      }
    });
  }

})();
