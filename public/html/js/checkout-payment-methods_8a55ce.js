(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (!root || !root.document) return;
    root.CheckoutPaymentMethods = api;
    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', () => api.initialize(root.document, root), { once: true });
    } else {
        api.initialize(root.document, root);
    }
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    function cents(value) {
        const match = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
        if (!match) return null;
        return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
    }

    function insufficientBalance(balance, price) {
        const available = cents(balance);
        const cost = cents(price);
        return available !== null && cost !== null && cost > 0n && available < cost;
    }

    let showFailure = () => {};
    function handleFailure(data) {
        if (data?.errors?.wallet_insufficient) showFailure();
    }

    async function parseCheckoutResponse(response) {
        const fallback = 'Unable to complete payment. Please check Order History before trying again.';
        // Fetch follows a redirect back to the checkout page. Its HTML is not a
        // successful payment response, and JSON parser details do not help customers.
        if (response.redirected) throw new Error(fallback);
        const data = await response.json().catch(() => null);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(fallback);
        if (!response.ok) {
            handleFailure(data);
            const message = typeof data.message === 'string' ? data.message.trim() : '';
            throw new Error(message || fallback);
        }
        return data;
    }

    function redirectWalletResponse(data, location) {
        if (!data || data.payment_method !== 'wallet') return false;
        if (typeof data.redirect_url !== 'string' || data.redirect_url.length === 0) {
            throw new Error('Unable to open your order. Please check Order History before paying again.');
        }
        const target = new URL(data.redirect_url, location.href);
        if (target.origin !== location.origin || target.username || target.password) {
            throw new Error('Unable to open your order. Please check Order History before paying again.');
        }
        location.assign(target.href);
        return true;
    }

    function initializeTerms(document, window) {
        const form = document.getElementById('game-checkout-form');
        if (!form) return;
        const checkboxes = Array.from(document.querySelectorAll('[data-checkout-terms]'))
            .filter(checkbox => checkbox.form === form);
        if (checkboxes.length === 0) return;
        const desktop = window.matchMedia('(min-width: 768px)');
        const refresh = () => {
            // Only the visible control participates in native form validation.
            // The mobile checkbox is outside the form and linked by its form attribute.
            checkboxes.forEach(checkbox => {
                checkbox.disabled = checkbox.dataset.checkoutTerms === 'desktop' ? !desktop.matches : desktop.matches;
            });
        };
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                checkboxes.forEach(other => { other.checked = checkbox.checked; });
            });
        });
        desktop.addEventListener('change', refresh);
        window.addEventListener('pageshow', () => {
            refresh();
            const visible = checkboxes.find(checkbox => !checkbox.disabled);
            checkboxes.forEach(checkbox => { checkbox.checked = Boolean(visible?.checked); });
        });
        // Cover both normal submission and the shared AJAX checkout handlers.
        form.addEventListener('submit', event => {
            refresh();
            const visible = checkboxes.find(checkbox => !checkbox.disabled);
            if (visible?.checked) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            visible?.reportValidity();
        }, true);
        refresh();
    }

    function initialize(document, window) {
        const input = document.querySelector('[data-checkout-payment-input]');
        const groups = Array.from(document.querySelectorAll('[data-payment-method-selector]'));
        if (!input || groups.length === 0 || input.dataset.initialized === 'true') return;
        input.dataset.initialized = 'true';
        initializeTerms(document, window);
        const preference = document.querySelector('[data-checkout-use-wallet]');
        const nonce = document.querySelector('[data-wallet-checkout-nonce]');
        const price = document.getElementById('amount');
        const total = document.getElementById('total_price');
        const signedIn = groups.every(group => group.dataset.walletSignedIn === 'true');
        const allowed = signedIn && groups.every(group => group.dataset.walletAvailable === 'true');
        let balance = null, available = false, explicit = null, selection = '', notice = '', generation = 0;
        const money = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
        const selectedTotal = () => total?.textContent?.trim().replace(/^\$/, '').replace(/,/g, '') || price?.value || '0';
        const selectionKey = () => ['product_id', 'bundle_id'].map(id => document.getElementById(id)?.value || '').join('|') + '|' + selectedTotal();

        function refresh() {
            const key = selectionKey();
            if (key !== selection) { selection = key; explicit = null; notice = ''; }
            const cost = cents(selectedTotal());
            const canPay = allowed && available && balance !== null && cost !== null && cost > 0n && balance >= cost;
            const selected = canPay && explicit !== false;
            input.value = selected ? 'wallet' : 'khqr';
            if (preference) preference.value = selected ? '1' : '0';
            // The same attempt key covers both methods, including retries after a lost response.
            if (nonce) nonce.disabled = false;
            groups.forEach(group => {
                group.querySelectorAll('[data-checkout-payment-choice]').forEach(button => {
                    const wallet = button.dataset.checkoutPaymentChoice === 'wallet';
                    button.dataset.selected = String(wallet ? selected : !selected);
                    if (wallet) {
                        button.disabled = !canPay;
                        button.setAttribute('aria-disabled', String(!canPay));
                        button.setAttribute('aria-checked', String(selected));
                    } else {
                        button.setAttribute('aria-pressed', String(!selected));
                    }
                });
                const note = group.querySelector('[data-wallet-note]');
                if (note && !signedIn) note.textContent = 'Sign in to pay with Wallet';
                else if (note && !allowed) note.textContent = 'Wallet payment is temporarily unavailable';
                else if (note) note.textContent = balance !== null ? `សមតុល្យ · Available balance $${money(balance)}` : 'កំពុងពិនិត្យ Wallet · Wallet unavailable until balance is checked';
                const insufficient = signedIn && available && cost !== null && balance !== null && balance < cost;
                const feedback = group.querySelector('[data-payment-feedback]');
                if (feedback) {
                    feedback.textContent = notice || (insufficient ? 'ទឹកប្រាក់មិនគ្រប់ · Wallet balance is not enough. ABA KHQR pays the full amount.' : '');
                    feedback.hidden = !feedback.textContent;
                }
                const hint = group.querySelector('[data-wallet-add-money]');
                if (hint) hint.hidden = !insufficient;
                const summary = group.querySelector('[data-payment-summary]');
                if (summary) summary.textContent = selected
                    ? `បង់តាម Wallet · -$${money(cost)} · នៅសល់ / Remaining $${money(balance - cost)}`
                    : 'បង់តាម ABA KHQR · Full amount with ABA KHQR';
            });
        }

        async function loadBalance() {
            if (!allowed) { refresh(); return; }
            const current = ++generation;
            try {
                const response = await window.fetch(groups[0].dataset.walletBalanceUrl, {
                    credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }
                });
                if (!response.ok) throw new Error('Balance unavailable');
                const data = await response.json();
                if (current !== generation) return;
                balance = cents(data?.balance);
                available = data?.wallet_available === true && balance !== null;
            } catch (_) {
                if (current !== generation) return;
                balance = null; available = false;
            }
            refresh();
        }
        showFailure = () => {
            explicit = false;
            notice = 'សមតុល្យបានប្រែប្រួល។ ជ្រើស ABA KHQR ហើយចុច Pay ម្ដងទៀត · Balance changed. Choose ABA KHQR and press Pay again. No wallet money was taken.';
            refresh();
            loadBalance();
        };
        groups.forEach(group => {
            group.querySelectorAll('[data-checkout-payment-choice]').forEach(button => {
                button.addEventListener('click', () => {
                    if (button.disabled) return;
                    explicit = button.dataset.checkoutPaymentChoice === 'wallet' ? input.value !== 'wallet' : false;
                    notice = '';
                    refresh();
                });
            });
        });
        if (total && window.MutationObserver) new window.MutationObserver(refresh).observe(total, { childList: true, subtree: true });
        document.addEventListener('change', refresh);
        window.addEventListener('pageshow', loadBalance);
        refresh();
        loadBalance();
    }

    return { cents, insufficientBalance, parseCheckoutResponse, redirectWalletResponse, handleFailure, initialize };
});
