(() => {
    const initializeFloatingSupportWidgets = () => {
        document.querySelectorAll('[data-support-widget]:not([data-initialized])').forEach((widget) => {
            widget.dataset.initialized = 'true';

            const trigger = widget.querySelector('[data-support-trigger]');
            const menu = widget.querySelector('[data-support-menu]');
            const closeButton = widget.querySelector('[data-support-close]');

            if (!trigger) return;

            const setOpen = (open) => {
                if (!menu) return;

                widget.dataset.open = open ? 'true' : 'false';
                trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
                menu.hidden = !open;

                if (open) closeButton?.focus({ preventScroll: true });
            };

            trigger.addEventListener('click', (event) => {
                if (trigger.matches('[aria-disabled="true"]')) {
                    event.preventDefault();
                    return;
                }

                if (menu) {
                    event.preventDefault();
                    setOpen(widget.dataset.open !== 'true');
                }
            });

            closeButton?.addEventListener('click', () => {
                setOpen(false);
                trigger.focus({ preventScroll: true });
            });

            document.addEventListener('pointerdown', (event) => {
                if (widget.dataset.open === 'true' && !widget.contains(event.target)) {
                    setOpen(false);
                }
            });

            widget.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && widget.dataset.open === 'true') {
                    setOpen(false);
                    trigger.focus({ preventScroll: true });
                }
            });
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFloatingSupportWidgets, { once: true });
    } else {
        initializeFloatingSupportWidgets();
    }
})();
