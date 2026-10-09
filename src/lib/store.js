const KEY = "porpor-topup";

const NICKS = [
  "Porpor",
  "Neary",
  "DaraKH",
  "Sokha",
  "BlueFox",
  "Vimean",
  "NightOwl",
  "LinaPP",
  "KhmerKing",
  "SreyMom",
];

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
    wallet: typeof s.wallet === "number" ? s.wallet : 8.5,
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

export function lookupNickname(userId) {
  let h = 0;
  for (const c of String(userId).trim()) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `${NICKS[h % NICKS.length]}${(h % 80) + 11}`;
}

export function applyCoupon(code, subtotal) {
  const c = String(code || "")
    .trim()
    .toUpperCase();
  if (!c) return { ok: true, discount: 0, code: "" };
  if (c === "PORPOR10") {
    return { ok: true, discount: Math.round(subtotal * 0.1 * 100) / 100, code: c };
  }
  if (c === "BLUE") {
    if (subtotal < 2) return { ok: false, error: "min", discount: 0, code: c };
    return { ok: true, discount: Math.min(0.5, subtotal), code: c };
  }
  return { ok: false, error: "bad", discount: 0, code: c };
}
