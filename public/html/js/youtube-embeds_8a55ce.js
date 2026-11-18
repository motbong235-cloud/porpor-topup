/* Enhance already-sanitized storefront rich text; never rewrite saved admin text. */
(function (global) {
    'use strict';

    const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
    const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

    function parseYouTubeUrl(value) {
        if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value) || !value) return null;
        let url;
        try {
            url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        } catch (_) {
            return null;
        }
        if (!['http:', 'https:'].includes(url.protocol) || !HOSTS.has(url.hostname)
            || url.username || url.password || url.port) return null;
        let id = null;
        if (url.hostname === 'youtu.be') {
            const match = /^\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
            id = match ? match[1] : null;
        } else if (url.pathname === '/watch') {
            const values = url.searchParams.getAll('v');
            id = values.length === 1 ? values[0] : null;
        } else {
            const match = /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
            id = match ? match[1] : null;
        }
        return typeof id === 'string' && VIDEO_ID.test(id) ? id : null;
    }

    class YouTubeRichText {
        constructor(root) {
            this.root = root;
            this.document = root.ownerDocument;
            this.dialog = root.closest('[role="dialog"]');
            this.enhance();
            this.observer = new MutationObserver(() => this.enhance());
            this.observer.observe(root, { childList: true, subtree: true });
            if (this.dialog) {
                this.dialogObserver = new MutationObserver(() => {
                    if (this.dialog.getAttribute('aria-hidden') === 'true') this.stop();
                    else this.resume();
                });
                this.dialogObserver.observe(this.dialog, { attributes: true, attributeFilter: ['aria-hidden'] });
            }
        }

        player(id) {
            const wrapper = this.document.createElement('span');
            wrapper.className = 'kira-youtube-video';
            wrapper.dataset.youtubeVideo = id;
            if (!this.dialog || this.dialog.getAttribute('aria-hidden') !== 'true') {
                wrapper.append(this.frame(id));
            }
            return wrapper;
        }

        excluded(element) {
            return Boolean(element.closest('.kira-youtube-video, pre, code, script, style, textarea, button, iframe'));
        }

        enhance() {
            // Existing server sanitization remains the HTML boundary. We inspect
            // text/URLs and build nodes; pasted strings never enter innerHTML.
            this.root.querySelectorAll('a[href]').forEach(anchor => {
                if (this.excluded(anchor)) return;
                const id = parseYouTubeUrl(anchor.getAttribute('href'));
                if (!id) return;
                const replacement = this.document.createDocumentFragment();
                const label = anchor.textContent.trim();
                if (label && parseYouTubeUrl(label) !== id) replacement.append(this.document.createTextNode(label + '\n'));
                replacement.append(this.player(id));
                anchor.replaceWith(replacement);
            });
            const walker = this.document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
            const texts = [];
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.parentElement && !this.excluded(node.parentElement) && !node.parentElement.closest('a')) texts.push(node);
            }
            texts.forEach(node => this.linkify(node));
        }

        linkify(node) {
            const text = node.textContent;
            const pattern = /\b(?:https?:\/\/|(?:www\.|m\.)?youtube\.com\/|youtu\.be\/)[^\s<>"']+/gi;
            const fragment = this.document.createDocumentFragment();
            let cursor = 0;
            let changed = false;
            for (const match of text.matchAll(pattern)) {
                const raw = match[0];
                const candidate = raw.replace(/[),.;!?\]}]+$/, '');
                // Do not interpret a domain inside an email or another hostname.
                if (!/^https?:\/\//i.test(candidate) && /[\w@.]/.test(text[match.index - 1] || '')) continue;
                let url;
                try {
                    url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
                } catch (_) {
                    continue;
                }
                if (!['http:', 'https:'].includes(url.protocol)) continue;
                fragment.append(this.document.createTextNode(text.slice(cursor, match.index)));
                const id = parseYouTubeUrl(candidate);
                if (id) {
                    fragment.append(this.player(id));
                } else {
                    const link = this.document.createElement('a');
                    link.href = url.href;
                    link.rel = 'noopener noreferrer';
                    link.textContent = candidate;
                    fragment.append(link);
                }
                fragment.append(this.document.createTextNode(raw.slice(candidate.length)));
                cursor = match.index + raw.length;
                changed = true;
            }
            if (changed) {
                fragment.append(this.document.createTextNode(text.slice(cursor)));
                node.replaceWith(fragment);
            }
        }

        frame(id) {
            // Revalidate at the final DOM sink, even if a data attribute changes.
            if (!VIDEO_ID.test(id || '')) return null;
            const frame = this.document.createElement('iframe');
            frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&playsinline=1&controls=1`;
            frame.title = 'YouTube video player';
            frame.loading = 'eager';
            frame.allow = 'encrypted-media; fullscreen';
            frame.allowFullscreen = true;
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
            // Only the site's origin is sent, never its path/query or account data.
            // YouTube requires a Referer; keep the page's own privacy policy intact.
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            return frame;
        }

        resume() {
            this.root.querySelectorAll('.kira-youtube-video').forEach(wrapper => {
                if (wrapper.querySelector('iframe')) return;
                const frame = this.frame(wrapper.dataset.youtubeVideo);
                if (frame) wrapper.append(frame);
            });
        }

        stop() {
            this.root.querySelectorAll('.kira-youtube-video > iframe').forEach(frame => frame.remove());
        }
    }

    const api = { parseYouTubeUrl, YouTubeRichText };
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof document !== 'undefined' && !global.KiraYouTubeEmbeds) {
        global.KiraYouTubeEmbeds = api;
        const mounted = new WeakSet();
        const mount = () => document.querySelectorAll('[data-youtube-richtext]').forEach(root => {
            if (!mounted.has(root)) {
                mounted.add(root);
                new YouTubeRichText(root);
            }
        });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
        else mount();
        document.addEventListener('livewire:navigated', mount);
    }
})(typeof window === 'object' ? window : globalThis);
