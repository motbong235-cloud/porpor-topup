/* Append this block to the END of public/html/js/floating-support-widget_c0feec.js */
(() => {
    const TELEGRAM_SVG =
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" data-icon="tg-real" style="width:1.7rem;height:1.7rem">' +
        '<defs><linearGradient id="pp-tg-grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#2AABEE"/><stop offset="1" stop-color="#229ED9"/></linearGradient></defs>' +
        '<circle cx="12" cy="12" r="12" fill="url(#pp-tg-grad)"/>' +
        '<path fill="#fff" d="M5.43 11.87c3.5-1.52 5.83-2.53 7-3.01 3.33-1.39 4.02-1.63 4.47-1.64.1 0 .32.02.46.14.12.1.16.23.17.33.02.1.04.31.02.48-.18 1.9-.96 6.5-1.36 8.62-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.69-1.66-1.12-2.69-1.8-1.19-.78-.42-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23.01-.03.01-.15-.06-.21-.07-.06-.17-.04-.25-.02-.11.02-1.8 1.14-5.09 3.36-.48.33-.92.49-1.31.48-.43-.01-1.26-.24-1.88-.44-.76-.25-1.36-.38-1.31-.8.03-.22.33-.45.9-.69z"/>' +
        '</svg>';

    const LIVECHAT_SVG =
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" data-icon="livechat-real" style="width:1.7rem;height:1.7rem">' +
        '<defs><linearGradient id="pp-lc-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#FFD24A"/><stop offset="1" stop-color="#F2951A"/></linearGradient></defs>' +
        '<path fill="url(#pp-lc-grad)" d="M12 2.5c-5.2 0-9.5 3.7-9.5 8.4 0 2.6 1.3 4.9 3.4 6.4v3.7l3.4-1.9c.8.2 1.7.3 2.7.3 5.2 0 9.5-3.7 9.5-8.5S17.2 2.5 12 2.5z"/>' +
        '<circle cx="8" cy="11" r="1.4" fill="#fff"/><circle cx="12" cy="11" r="1.4" fill="#fff"/><circle cx="16" cy="11" r="1.4" fill="#fff"/>' +
        '</svg>';

    const LOGIN_SVG =
        '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon="login-real">' +
        '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/>' +
        '</svg>';

    const swap = (host, svg, marker) => {
        if (!host || host.querySelector('[data-icon="' + marker + '"]')) return;
        host.innerHTML = svg;
    };

    const applyIcons = () => {
        document.querySelectorAll('[data-support-contact="telegram"] .floating-support-widget__contact-icon')
            .forEach((el) => swap(el, TELEGRAM_SVG, 'tg-real'));
        document.querySelectorAll('[data-support-contact="livechat"] .floating-support-widget__contact-icon')
            .forEach((el) => swap(el, LIVECHAT_SVG, 'livechat-real'));
        document.querySelectorAll('.customer-login-action__icon')
            .forEach((el) => swap(el, LOGIN_SVG, 'login-real'));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyIcons, { once: true });
    } else {
        applyIcons();
    }
    window.addEventListener('load', applyIcons);
})();
