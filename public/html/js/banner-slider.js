(() => {
    const DEFAULT_DURATION = 5000;
    const SWIPE_AXIS_THRESHOLD = 8;

    function initializeBannerSlider(root) {
        if (root.dataset.sliderInitialized === 'true') return;

        const viewport = root.querySelector('[data-slider-viewport]');
        const track = root.querySelector('[data-slider-track]');
        const slides = Array.from(track?.querySelectorAll('.slide') ?? []);
        const progressBars = Array.from(root.querySelectorAll('.pg-bar'));
        const realCount = Number.parseInt(root.dataset.slideCount ?? '0', 10);

        if (!viewport || !track || realCount < 1) return;

        root.dataset.sliderInitialized = 'true';

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let physicalIndex = realCount > 1 ? 1 : 0;
        let logicalIndex = 0;
        let slideTimer = null;
        let isAnimating = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchCurrentX = 0;
        let gestureAxis = null;
        let suppressClick = false;

        function logicalIndexForPhysical(index) {
            if (realCount <= 1) return 0;
            if (index === 0) return realCount - 1;
            if (index === realCount + 1) return 0;
            return index - 1;
        }

        function setTrackPosition(index, animate = true, dragOffset = 0) {
            track.classList.toggle('is-instant', !animate);
            const percentage = -(index * 100);
            track.style.transform = dragOffset === 0
                ? `translateX(${percentage}%)`
                : `translateX(calc(${percentage}% + ${dragOffset}px))`;

            if (!animate) {
                void track.offsetWidth;
                track.classList.remove('is-instant');
            }
        }

        function updateAccessibleState() {
            progressBars.forEach((bar, index) => {
                const active = index === logicalIndex;
                bar.classList.toggle('active', active);
                bar.setAttribute('aria-current', active ? 'true' : 'false');
            });

            slides.forEach((slide) => {
                const isClone = slide.dataset.clone === 'true';
                const isCurrent = Number(slide.dataset.realIndex) === logicalIndex;
                slide.setAttribute('aria-hidden', isClone || !isCurrent ? 'true' : 'false');
            });
        }

        function currentDuration() {
            const realSlide = slides.find((slide) => (
                slide.dataset.clone !== 'true'
                && Number(slide.dataset.realIndex) === logicalIndex
            ));
            const duration = Number.parseInt(realSlide?.dataset.duration ?? '', 10);

            return Number.isInteger(duration) && duration > 0 ? duration : DEFAULT_DURATION;
        }

        function clearTimer() {
            if (slideTimer !== null) {
                window.clearTimeout(slideTimer);
                slideTimer = null;
            }
        }

        function scheduleNext() {
            clearTimer();
            if (realCount <= 1 || reducedMotion || document.hidden) return;
            slideTimer = window.setTimeout(moveNext, currentDuration());
        }

        function finishImmediatelyIfNeeded() {
            if (!reducedMotion) return;
            isAnimating = false;
            logicalIndex = logicalIndexForPhysical(physicalIndex);
            updateAccessibleState();
        }

        function moveNext() {
            if (realCount <= 1 || isAnimating) return;
            clearTimer();
            physicalIndex += 1;
            logicalIndex = logicalIndexForPhysical(physicalIndex);
            isAnimating = !reducedMotion;
            updateAccessibleState();
            setTrackPosition(physicalIndex, !reducedMotion);
            finishImmediatelyIfNeeded();
        }

        function movePrevious() {
            if (realCount <= 1 || isAnimating) return;
            clearTimer();
            physicalIndex -= 1;
            logicalIndex = logicalIndexForPhysical(physicalIndex);
            isAnimating = !reducedMotion;
            updateAccessibleState();
            setTrackPosition(physicalIndex, !reducedMotion);
            finishImmediatelyIfNeeded();
        }

        function moveTo(realIndex) {
            if (realIndex < 0 || realIndex >= realCount || isAnimating) return;
            if (realIndex === logicalIndex) {
                scheduleNext();
                return;
            }
            clearTimer();
            physicalIndex = realCount > 1 ? realIndex + 1 : 0;
            logicalIndex = realIndex;
            isAnimating = !reducedMotion && realCount > 1;
            updateAccessibleState();
            setTrackPosition(physicalIndex, isAnimating);

            if (!isAnimating) scheduleNext();
        }

        track.addEventListener('transitionend', (event) => {
            if (event.target !== track || event.propertyName !== 'transform') return;

            if (physicalIndex === realCount + 1) {
                physicalIndex = 1;
                setTrackPosition(physicalIndex, false);
            } else if (physicalIndex === 0) {
                physicalIndex = realCount;
                setTrackPosition(physicalIndex, false);
            }

            logicalIndex = logicalIndexForPhysical(physicalIndex);
            isAnimating = false;
            updateAccessibleState();
            scheduleNext();
        });

        progressBars.forEach((bar) => {
            bar.addEventListener('click', () => moveTo(Number(bar.dataset.index)));
        });

        viewport.addEventListener('touchstart', (event) => {
            if (realCount <= 1 || isAnimating || event.touches.length !== 1) return;
            const touch = event.touches[0];
            clearTimer();
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchCurrentX = touch.clientX;
            gestureAxis = null;
            suppressClick = false;
        }, { passive: true });

        viewport.addEventListener('touchmove', (event) => {
            if (realCount <= 1 || isAnimating || event.touches.length !== 1) return;
            const touch = event.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            touchCurrentX = touch.clientX;

            if (gestureAxis === null) {
                if (Math.abs(deltaX) < SWIPE_AXIS_THRESHOLD && Math.abs(deltaY) < SWIPE_AXIS_THRESHOLD) return;
                gestureAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }

            if (gestureAxis !== 'horizontal') return;
            if (event.cancelable) event.preventDefault();
            suppressClick = true;
            track.classList.add('is-dragging');
            setTrackPosition(physicalIndex, true, deltaX);
        }, { passive: false });

        viewport.addEventListener('touchend', () => {
            if (realCount <= 1 || isAnimating) return;

            if (gestureAxis !== 'horizontal') {
                gestureAxis = null;
                scheduleNext();
                return;
            }

            const deltaX = touchCurrentX - touchStartX;
            const threshold = Math.min(90, Math.max(42, viewport.clientWidth * 0.14));
            track.classList.remove('is-dragging');
            gestureAxis = null;

            if (deltaX <= -threshold) {
                moveNext();
            } else if (deltaX >= threshold) {
                movePrevious();
            } else {
                isAnimating = !reducedMotion;
                setTrackPosition(physicalIndex, !reducedMotion);
                if (!isAnimating) scheduleNext();
            }

            window.setTimeout(() => { suppressClick = false; }, 350);
        }, { passive: true });

        viewport.addEventListener('touchcancel', () => {
            if (gestureAxis !== 'horizontal') {
                gestureAxis = null;
                scheduleNext();
                return;
            }

            track.classList.remove('is-dragging');
            gestureAxis = null;
            isAnimating = !reducedMotion;
            setTrackPosition(physicalIndex, !reducedMotion);
            if (!isAnimating) scheduleNext();
        }, { passive: true });

        root.addEventListener('click', (event) => {
            if (!suppressClick) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);

        root.addEventListener('mouseenter', clearTimer);
        root.addEventListener('mouseleave', scheduleNext);
        root.addEventListener('focusin', clearTimer);
        root.addEventListener('focusout', scheduleNext);
        window.addEventListener('resize', () => setTrackPosition(physicalIndex, false), { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearTimer(); else scheduleNext();
        });

        setTrackPosition(physicalIndex, false);
        updateAccessibleState();
        scheduleNext();
    }

    function initializeAllBannerSliders() {
        document.querySelectorAll('[data-slider]').forEach(initializeBannerSlider);
    }

    initializeAllBannerSliders();
    document.addEventListener('livewire:navigated', initializeAllBannerSliders);
})();
