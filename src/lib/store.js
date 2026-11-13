const KEY = "porpor-topup";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getPrefs() {
  const s = load();
  return {
    lang: s.lang === "en" ? "en" : "km",
    theme: s.theme === "dark" ? "dark" : "light",
    orders: Array.isArray(s.orders) ? s.orders : [],
  };
}

export function savePrefs(patch) {
  const next = { ...load(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function money(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

/** Preview only — the server recalculates the discount at checkout. */
export function applyCoupon(code, subtotal, coupons = []) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return { ok: true, discount: 0, code: "" };
  const found = coupons.find((x) => String(x.code).toUpperCase() === c);
  if (!found) return { ok: false, error: "bad", discount: 0, code: c };
  if (subtotal < (Number(found.min) || 0)) return { ok: false, error: "min", discount: 0, code: c };
  const raw = found.type === "fixed" ? Number(found.value) || 0 : (subtotal * (Number(found.value) || 0)) / 100;
  return { ok: true, discount: Math.min(subtotal, Math.round(raw * 100) / 100), code: c };
}
