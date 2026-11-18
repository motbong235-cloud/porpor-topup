(function (root) {
    'use strict';

    const normalize = (eligibility) => {
        const restricted = eligibility?.restricted === true;
        const eligibleProductIds = restricted
            ? new Set((eligibility.eligible_product_ids || []).map((id) => String(id)))
            : null;

        return { restricted, eligibleProductIds };
    };

    const isPackageEligible = (state, type, id) => {
        return !state.restricted
            || (type === 'product' && state.eligibleProductIds.has(String(id)));
    };

    const shouldClearSelection = (state, productId, bundleId) => {
        return state.restricted
            && (Boolean(bundleId)
                || (Boolean(productId) && !state.eligibleProductIds.has(String(productId))));
    };

    root.MlbbBonusCatalog = Object.freeze({
        normalize,
        isPackageEligible,
        shouldClearSelection,
    });
})(typeof window !== 'undefined' ? window : globalThis);
