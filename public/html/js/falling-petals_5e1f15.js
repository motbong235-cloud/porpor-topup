(() => {
    'use strict';
    const layer = document.querySelector('[data-falling-petals]');
    if (!layer || layer.dataset.initialized === 'true') return;
    layer.dataset.initialized = 'true';
    let failed = false;
    // Keep unstyled images out of normal document flow while CSS is delayed or
    // unavailable, including in embedded mobile browsers and restored pages.
    const reveal = () => { layer.hidden = failed || getComputedStyle(layer).position !== 'fixed'; };
    const hide = () => { failed = true; layer.hidden = true; };
    const stylesheet = document.querySelector('[data-falling-petals-styles]');
    stylesheet?.addEventListener('load', reveal);
    stylesheet?.addEventListener('error', hide);
    const pause = () => { layer.dataset.paused = String(document.hidden); };
    // CSS drives every frame; JS only handles page lifecycle and broken assets.
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('pagehide', () => { layer.dataset.paused = 'true'; });
    window.addEventListener('pageshow', () => { pause(); reveal(); });
    layer.querySelectorAll('img').forEach(image => {
        image.addEventListener('error', hide, { once: true });
        if (image.complete && image.naturalWidth === 0) hide();
    });
    pause();
    reveal();
})();
