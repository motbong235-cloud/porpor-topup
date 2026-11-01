/**
 * Dino Topups reseller API
 * Base: https://dinotopups.com/api/reseller/v1
 * Env: DINO_TOPUP_API_KEY
 */
import crypto from "crypto";

const BASE = (process.env.DINO_TOPUP_URL || "https://dinotopups.com/api/reseller/v1").replace(/\/$/, "");

function key() {
  return (process.env.DINO_TOPUP_API_KEY || process.env.DINO_API_KEY || "").trim();
}

export function isDinoReady() {
  return Boolean(key());
}

async function api(path, opts = {}) {
  if (!isDinoReady()) {
    throw Object.assign(new Error("DINO_TOPUP_API_KEY not set"), { code: "not_configured" });
  }
  const k = key();
  const headers = {
    "X-API-Key": k,
    Authorization: `Bearer ${k}`,
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };
  const method = String(opts.method || "GET").toUpperCase();
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    method,
    headers,
    signal: AbortSignal.timeout(method === "POST" ? 35000 : 15000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = data?.error?.code || data?.code || `HTTP_${r.status}`;
    const msg = data?.error?.message || data?.message || data?.error || `HTTP ${r.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = r.status;
    err.code = code;
    err.data = data;
    throw err;
  }
  return data;
}

export function mapGameId(gameId) {
  const g = String(gameId || "").toLowerCase().trim();
  const map = {
    ml: "ml",
    mlbb: "ml",
    "mobile-legends": "ml",
    "mobile legends": "ml",
    ff: "ff",
    freefire: "ff",
    "free-fire": "ff",
    pubg: "pubg",
    pubgm: "pubg",
    hok: "hok",
    "honor-of-kings": "hok",
    genshin: "genshin",
    gi: "genshin",
    roblox: "roblox",
    robux: "roblox",
  };
  return map[g] || g;
}

export async function getBalance() {
  return api("/balance");
}

export async function listProducts(game) {
  const q = game ? `?game=${encodeURIComponent(mapGameId(game))}` : "";
  return api(`/products${q}`);
}

export async function checkId(game, playerId, zoneId) {
  const q = new URLSearchParams({
    game: mapGameId(game),
    player_id: String(playerId),
  });
  if (zoneId) q.set("zone_id", String(zoneId));
  return api(`/check-id?${q}`);
}

export async function placeOrder({ game, product, playerId, zoneId, quantity, reference, maxPrice }) {
  const body = {
    game: mapGameId(game),
    product: String(product),
    player_id: String(playerId),
    reference: String(reference),
  };
  if (zoneId) body.zone_id = String(zoneId);
  if (quantity && Number(quantity) > 1) body.quantity = Number(quantity);
  if (maxPrice != null && Number(maxPrice) > 0) body.max_price = Number(maxPrice);
  return api("/orders", { method: "POST", body: JSON.stringify(body) });
}

export async function getOrder(orderIdOrRef) {
  return api(`/orders/${encodeURIComponent(orderIdOrRef)}`);
}

export async function listOrders(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return api(`/orders${s ? `?${s}` : ""}`);
}

/** Docs: HMAC-SHA256 of `${timestamp}.${rawBody}` ; reject ts older than 5 min */
export function verifyWebhookSignature(rawBody, timestamp, signature, secret) {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const want = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const got = String(signature).replace(/^v1=/, "").trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
  } catch {
    return false;
  }
}

export function summarizeDinoStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "success") return { status: "done", done: true };
  if (s === "failed") return { status: "failed", done: true };
  if (s === "partial") return { status: "partial", done: true };
  if (s === "processing" || s === "pending" || s === "review") return { status: "processing", done: false };
  return { status: s || "processing", done: false };
}
