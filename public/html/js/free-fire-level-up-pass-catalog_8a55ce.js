(function (root) {
    'use strict';

    const levels = Object.freeze(['Lv6', 'Lv10', 'Lv15', 'Lv20', 'Lv25', 'Lv30']);

    const normalize = (section) => {
        if (section?.allowed === false) {
            return Object.freeze(Object.fromEntries(levels.map((level) => [level, 'restricted'])));
        }
        const source = section?.details;
        if (!source || typeof source !== 'object' || Array.isArray(source)) return null;

        const keys = Object.keys(source);
        if (keys.length !== levels.length || keys.some((level) => !levels.includes(level))) return null;

        const details = {};
        for (const level of levels) {
            if (source[level] !== 'available' && source[level] !== 'restricted') return null;
            details[level] = source[level];
        }

        return Object.freeze(details);
    };

    const isPackageEligible = (details, level) => {
        if (!level) return true;

        return details?.[level] === 'available';
    };

    const isPackageSelectable = (details, level) => {
        return !level || details === null || isPackageEligible(details, level);
    };

    const shouldClearSelection = (details, level) => {
        return Boolean(level && details !== null && !isPackageEligible(details, level));
    };

    root.FreeFireLevelUpPassCatalog = Object.freeze({
        levels,
        normalize,
        isPackageEligible,
        isPackageSelectable,
        shouldClearSelection,
    });
})(typeof window !== 'undefined' ? window : globalThis);
