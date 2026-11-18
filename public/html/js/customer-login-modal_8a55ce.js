'use strict';

const TELEGRAM_ORIGIN = 'https://oauth.telegram.org';
const TELEGRAM_AUTH_RESULT_URL = `${TELEGRAM_ORIGIN}/auth/get`;
const TELEGRAM_RELAY_EVENT = 'natsu_telegram_auth_result';
const TELEGRAM_POPUP_POLL_MS = 100;
const TELEGRAM_RESULT_FIELDS = [
    'id',
    'first_name',
    'last_name',
    'username',
    'photo_url',
    'auth_date',
    'hash',
];

function revealUnsupportedFallback(documentRef) {
    if (typeof documentRef?.querySelector !== 'function'
        || !documentRef.querySelector('[data-customer-login-auto-open]')) {
        return;
    }

    documentRef.querySelector('[data-customer-login-fallback]')?.removeAttribute('hidden');
}

function telegramPopupFeatures(scope) {
    const width = 550;
    const height = 600;
    const screen = scope.screen ?? { width, height, availLeft: 0, availTop: 0 };
    const left = Math.max(0, (screen.width - width) / 2) + (screen.availLeft ?? 0);
    const top = Math.max(0, (screen.height - height) / 2) + (screen.availTop ?? 0);

    return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

function useTelegramFullPageLogin(scope) {
    const navigator = scope.navigator ?? {};

    return /Android|iPhone|iPad|iPod|Telegram|FBAN|FBAV|Instagram/i.test(navigator.userAgent ?? '')
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function initTelegramLoginPopup(dialog, scope) {
    const link = dialog?.querySelector('[data-customer-login-telegram]');
    const error = dialog?.querySelector('[data-customer-login-error]');
    if (!link
        || typeof link.addEventListener !== 'function'
        || typeof scope?.open !== 'function'
        || typeof scope.fetch !== 'function'
        || typeof scope.setTimeout !== 'function'
        || typeof scope.clearTimeout !== 'function') {
        return;
    }

    let activeAttempt = null;
    const showError = message => {
        if (!error) {
            return;
        }

        error.textContent = message;
        error.removeAttribute('hidden');
    };
    const clearError = () => {
        if (!error) {
            return;
        }

        error.textContent = '';
        error.setAttribute('hidden', '');
    };
    const cleanup = attempt => {
        if (activeAttempt !== attempt) {
            return;
        }

        if (attempt.pollTimer !== null) {
            scope.clearTimeout(attempt.pollTimer);
        }
        scope.removeEventListener('message', attempt.onMessage);
        activeAttempt = null;
    };

    link.addEventListener('click', async event => {
        if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();
        clearError();
        if (activeAttempt && !activeAttempt.popup.closed) {
            activeAttempt.popup.focus();

            return;
        }
        if (activeAttempt) {
            cleanup(activeAttempt);
        }

        // Mobile/in-app browsers can isolate popup cookies or close the popup
        // before its result reaches the opener. The existing full-page flow
        // completes in this tab and still verifies the one-time state and HMAC.
        if (useTelegramFullPageLogin(scope)) {
            scope.location.assign(link.href);

            return;
        }

        const popup = scope.open(
            'about:blank',
            'telegram_oauth_login',
            telegramPopupFeatures(scope),
        );
        if (!popup) {
            scope.location.assign(link.href);

            return;
        }

        const attempt = {
            popup,
            botId: null,
            callbackUrl: null,
            onMessage: null,
            pollTimer: null,
            authFinished: false,
        };
        const finish = authData => {
            if (activeAttempt !== attempt
                || attempt.authFinished
                || !authData
                || typeof authData !== 'object'
                || !attempt.callbackUrl) {
                return false;
            }

            const callback = new URL(attempt.callbackUrl);
            for (const field of TELEGRAM_RESULT_FIELDS) {
                const value = authData[field];
                if (typeof value === 'string' || typeof value === 'number') {
                    callback.searchParams.set(field, String(value));
                }
            }

            attempt.authFinished = true;
            if (!popup.closed) {
                popup.close();
            }
            cleanup(attempt);
            // replace(): the signed callback URL must not remain in the tab's history.
            scope.location.replace(callback.toString());

            return true;
        };
        const fail = () => {
            // A late /auth/get answer after the message path already finished must
            // not paint an error over a login that is navigating away.
            if (attempt.authFinished) {
                return;
            }

            cleanup(attempt);
            showError('Telegram login did not finish. Please try again.');
        };
        attempt.pollClosed = async () => {
            if (activeAttempt !== attempt || attempt.authFinished) {
                return;
            }
            if (!popup.closed) {
                attempt.pollTimer = scope.setTimeout(attempt.pollClosed, TELEGRAM_POPUP_POLL_MS);

                return;
            }

            try {
                const response = await scope.fetch(TELEGRAM_AUTH_RESULT_URL, {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: new URLSearchParams({ bot_id: attempt.botId }).toString(),
                });
                const payload = await response.json();
                if (!response.ok
                    || payload?.origin !== scope.location.origin
                    || !finish(payload?.user)) {
                    throw new Error('Telegram did not return a trusted login result.');
                }
            } catch {
                fail();
            }
        };
        attempt.onMessage = messageEvent => {
            if (messageEvent.source !== popup) {
                return;
            }

            let message = messageEvent.data;
            if (typeof message === 'string') {
                try {
                    message = JSON.parse(message);
                } catch {
                    return;
                }
            }
            const trustedProviderResult = messageEvent.origin === TELEGRAM_ORIGIN
                && message?.event === 'auth_result';
            const trustedCallbackRelay = messageEvent.origin === scope.location.origin
                && message?.event === TELEGRAM_RELAY_EVENT;
            if ((!trustedProviderResult && !trustedCallbackRelay)
                || !message.result
                || typeof message.result !== 'object') {
                return;
            }

            finish(message.result);
        };
        activeAttempt = attempt;
        scope.addEventListener('message', attempt.onMessage);

        try {
            const startUrl = new URL(link.href, scope.location.href);
            // The server rejects a fragment in return_to; the page's own hash (an
            // in-page anchor) must not turn a popup login into the full-page fallback.
            const returnTo = new URL(scope.location.href);
            returnTo.hash = '';
            startUrl.searchParams.set('return_to', returnTo.toString());
            const response = await scope.fetch(startUrl.toString(), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json();
            const authorization = new URL(payload.authorization_url);
            const callback = new URL(payload.callback_url);
            if (!response.ok
                || authorization.origin !== TELEGRAM_ORIGIN
                || authorization.pathname !== '/auth'
                || callback.origin !== scope.location.origin
                || !/^\d{6,20}$/.test(authorization.searchParams.get('bot_id') ?? '')) {
                throw new Error('Invalid Telegram login start response.');
            }

            attempt.botId = authorization.searchParams.get('bot_id');
            attempt.callbackUrl = callback.toString();
            popup.location.replace(authorization.toString());
            attempt.pollTimer = scope.setTimeout(attempt.pollClosed, TELEGRAM_POPUP_POLL_MS);
        } catch {
            popup.close();
            cleanup(attempt);
            scope.location.assign(link.href);
        }
    });
}

function bindCheckoutLoginForms(documentRef, open) {
    documentRef.querySelectorAll('form[data-customer-login-required]').forEach(form => {
        form.addEventListener('submit', event => {
            // Capture before checkout's bubble listener can send a payment request
            // or switch Pay Now to Processing. The server still enforces login.
            event.preventDefault();
            event.stopImmediatePropagation();
            open(form, event.submitter);
        }, true);
    });
}

export function initCustomerLoginModal(documentRef, HTMLElementType, HTMLDialogElementType) {
    const dialog = documentRef.querySelector('[data-customer-login-modal]');
    const autoOpen = documentRef.querySelector('[data-customer-login-auto-open]');
    if (typeof HTMLElementType !== 'function'
        || typeof HTMLDialogElementType !== 'function'
        || !(dialog instanceof HTMLDialogElementType)) {
        bindCheckoutLoginForms(documentRef, form => {
            documentRef.defaultView.location.assign(form.getAttribute('data-customer-login-required'));
        });
        revealUnsupportedFallback(documentRef);

        return;
    }

    initTelegramLoginPopup(dialog, documentRef.defaultView);

    let opener = null;
    const open = (trigger = null) => {
        opener = trigger instanceof HTMLElementType ? trigger : null;
        if (!dialog.open) {
            dialog.showModal();
        }
        dialog.querySelector('[data-customer-login-close]')?.focus();
    };

    bindCheckoutLoginForms(documentRef, (form, trigger) => {
        open(trigger ?? form.querySelector('[type="submit"]'));
    });

    documentRef.querySelectorAll('[data-customer-login-open]').forEach(trigger => {
        trigger.addEventListener('click', event => {
            event.preventDefault();
            open(trigger);
        });
    });

    dialog.querySelector('[data-customer-login-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        // Keyboard activation of a control inside the panel dispatches a click at
        // (0,0); only a click whose target is the dialog itself can be the backdrop.
        if (event.target !== dialog) {
            return;
        }

        const bounds = dialog.getBoundingClientRect();
        const outside = event.clientX < bounds.left
            || event.clientX > bounds.right
            || event.clientY < bounds.top
            || event.clientY > bounds.bottom;
        if (outside) {
            dialog.close();
        }
    });
    dialog.addEventListener('close', () => {
        if (opener) {
            opener.focus();

            return;
        }

        const returnUrl = autoOpen?.getAttribute('data-customer-login-return-url');
        if (returnUrl) {
            documentRef.defaultView.location.assign(returnUrl);
        }
    });

    if (autoOpen) {
        open();
    }
}

export function autoInitCustomerLoginModal(scope = globalThis) {
    if (typeof scope.document !== 'undefined') {
        initCustomerLoginModal(scope.document, scope.HTMLElement, scope.HTMLDialogElement);
    }
}

autoInitCustomerLoginModal();
