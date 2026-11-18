(function (root) {
    'use strict';

    function initialize(document, window) {
        document.querySelectorAll('[data-catalog-section]').forEach(section => {
            if (section.dataset.catalogInitialized === 'true') return;
            section.dataset.catalogInitialized = 'true';
            const grid = section.querySelector('[data-catalog-grid]');
            const sentinel = section.querySelector('[data-catalog-sentinel]');
            const indicator = section.querySelector('[data-catalog-loading]');
            const skeleton = section.querySelector('[data-catalog-skeleton]');
            let offset = section.dataset.nextOffset === '' ? null : Number(section.dataset.nextOffset);
            let revision = section.dataset.revision;
            let pending = false;
            let failures = 0;
            let retry = null;
            let observer;
            const seen = new Set(Array.from(grid.querySelectorAll('[data-catalog-id]'), card => Number(card.dataset.catalogId)));
            const nearBottom = () => {
                const rect = sentinel.getBoundingClientRect();
                return rect.top <= window.innerHeight + 480 && rect.bottom >= 0;
            };

            async function load() {
                if (pending || offset === null || failures >= 3 || !nearBottom()) return;
                pending = true;
                if (skeleton) skeleton.hidden = false;
                indicator.hidden = false;
                indicator.textContent = 'Loading games…';
                const controller = new window.AbortController();
                const timeout = window.setTimeout(() => controller.abort(), 10000);
                try {
                    const query = new URLSearchParams({section: section.dataset.catalogSection, category: section.dataset.category, offset: String(offset), revision});
                    // Use the browser HTTP cache/ETag; do not append a cache-busting timestamp.
                    const response = await window.fetch('/api/catalog?' + query, {headers: {Accept: 'application/json'}, cache: 'default', credentials: 'omit', signal: controller.signal});
                    if (!response.ok) throw new Error('Catalog unavailable');
                    const page = await response.json();
                    if (!Array.isArray(page.ids) || page.ids.length > 20 || new Set(page.ids).size !== page.ids.length
                        || !page.ids.every(id => Number.isSafeInteger(id) && id > 0)
                        || typeof page.html !== 'string' || !/^[a-f0-9]{64}$/.test(page.revision)
                        || typeof page.reset !== 'boolean' || !Number.isSafeInteger(page.total) || page.total < 0
                        || !(page.next_offset === null || (Number.isSafeInteger(page.next_offset) && page.next_offset > (page.reset ? 0 : offset)))) {
                        throw new Error('Invalid catalog');
                    }
                    const template = document.createElement('template');
                    template.innerHTML = page.html;
                    template.content.querySelectorAll('script').forEach(script => script.remove());
                    const cards = Array.from(template.content.children);
                    if (cards.length !== page.ids.length || cards.some((card, i) => Number(card.dataset.catalogId) !== page.ids[i])) throw new Error('Invalid catalog cards');
                    if (page.reset) {
                        grid.replaceChildren();
                        seen.clear();
                    }
                    cards.forEach(card => {
                        const id = Number(card.dataset.catalogId);
                        if (!seen.has(id)) {
                            // Existing square image boxes reserve height; newly appended
                            // cards must not stay hidden by the initial entrance observer.
                            card.querySelectorAll('.entrance-animate').forEach(element => element.classList.add('is-visible'));
                            grid.append(card);
                            seen.add(id);
                        }
                    });
                    if (skeleton) skeleton.hidden = true;
                    offset = page.next_offset;
                    revision = page.revision;
                    failures = 0;
                    indicator.hidden = true;
                    if (offset === null && observer) observer.disconnect();
                } catch (_) {
                    if (skeleton) skeleton.hidden = true;
                    failures++;
                    indicator.textContent = failures < 3 ? 'Games could not load. Retrying…' : 'Games could not load. They will retry when you reconnect or scroll back.';
                    if (failures < 3) retry = window.setTimeout(load, failures * 2000);
                } finally {
                    window.clearTimeout(timeout);
                    pending = false;
                }
                if (!failures && offset !== null) window.requestAnimationFrame(load);
            }

            if ('IntersectionObserver' in window) {
                observer = new window.IntersectionObserver(entries => {
                    if (entries.some(entry => entry.isIntersecting)) {
                        if (failures >= 3) failures = 0;
                        load();
                    }
                }, {rootMargin: '480px 0px', threshold: 0});
                if (offset !== null) observer.observe(sentinel);
            } else {
                window.addEventListener('scroll', load, {passive: true});
                window.addEventListener('resize', load, {passive: true});
                load();
            }
            window.addEventListener('online', () => {
                window.clearTimeout(retry);
                failures = 0;
                load();
            });
        });
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = {initialize};
    else initialize(root.document, root);
})(typeof window === 'undefined' ? globalThis : window);
