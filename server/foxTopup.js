/**
 * Fox Topup (Fox Store) reseller API
 * Base: https://api.topupfoxbot.com/v1
 * Docs: https://reseller.topupfoxbot.com
 *
 * Env:
 *   FOX_TOPUP_UID         numeric reseller id   (header X-Uid)
 *   FOX_TOPUP_API_KEY     api key               (header X-Api-Key)
 *   FOX_TOPUP_API_SECRET  api secret            (HMAC signing + AES-GCM body encryption)
 *   FOX_WEBHOOK_SECRET    webhook secret        (X-Fox-Signature: sha256=<hmac>)
 *
 * Route kinds (from the docs):
 *   API Key   → plain GET with X-Uid + X-Api-Key         (users/me, games, balance/deposits)
 *   Signed    → + HMAC signature                          (orders, rotate)
 *   Encrypted → + HMAC signature + AES-GCM encrypted body (games/{code}/lookup)
 *
 * NOTE: the plain "API Key" routes follow the docs exactly. The exact HMAC canonical string
 * and AES-GCM envelope are implemented in signRequest()/encryptBody() below — those two
 * functions are the ONLY place to adjust if the Python / Node client in the docs differs.
 */
import crypto from "crypto";

const BASE = (process.env.FOX_TOPUP_URL || "https://api.topupfoxbot.com/v1").replace(/\/$/, "");

const uid = () => (process.env.FOX_TOPUP_UID || process.env.FOX_UID || "").trim();
const key = () => (process.env.FOX_TOPUP_API_KEY || process.env.FOX_API_KEY || "").trim();
const secret = () => (process.env.FOX_TOPUP_API_SECRET || process.env.FOX_API_SECRET || "").trim();

export function isFoxReady() {
  return Boolean(uid() && key());
}
export function isFoxSigningReady() {
  return isFoxReady() && Boolean(secret());
}

/* ---------- signing / encryption (adjust here if the official client differs) ---------- */

function signRequest(method, path, rawBody) {
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(12).toString("hex");
  const bodyHash = crypto.createHash("sha256").update(rawBody || "").digest("hex");
  const canonical = [ts, nonce, method, `/v1${path.split("?")[0]}`, bodyHash].join("\n");
  const sig = crypto.createHmac("sha256", secret()).update(canonical).digest("hex");
  return { "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": sig };
}

function encryptBody(rawJson) {
  const aesKey = crypto.createHash("sha256").update(secret()).digest(); // 32 bytes
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([c.update(rawJson, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("base64"),
    data: ct.toString("base64"),
    tag: tag.toString("base64"),
  });
}

function decryptMaybe(data) {
  if (!data || typeof data !== "object" || !data.iv || !data.data || !data.tag) return data;
  try {
    const aesKey = crypto.createHash("sha256").update(secret()).digest();
    const d = crypto.createDecipheriv("aes-256-gcm", aesKey, Buffer.from(data.iv, "base64"));
    d.setAuthTag(Buffer.from(data.tag, "base64"));
    const txt = Buffer.concat([d.update(Buffer.from(data.data, "base64")), d.final()]).toString("utf8");
    return JSON.parse(txt);
  } catch {
    return data;
  }
}

/* ---------- transport ---------- */

async function api(path, { method = "GET", body, signed = false, encrypted = false } = {}) {
  if (!isFoxReady()) {
    throw Object.assign(new Error("FOX_TOPUP_UID / FOX_TOPUP_API_KEY not set"), { code: "not_configured" });
  }
  if ((signed || encrypted) && !secret()) {
    throw Object.assign(new Error("FOX_TOPUP_API_SECRET not set"), { code: "not_configured" });
  }
  method = method.toUpperCase();
  let raw = body != null ? JSON.stringify(body) : "";
  const headers = {
    "X-Uid": uid(),
    "X-Api-Key": key(),
    Accept: "application/json",
  };
  if (encrypted && raw) raw = encryptBody(raw);
  if (signed || encrypted) Object.assign(headers, signRequest(method, path, raw));
  if (raw) headers["Content-Type"] = "application/json";

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: raw || undefined,
    signal: AbortSignal.timeout(method === "POST" ? 35000 : 15000),
  });
  let data = await r.json().catch(() => ({}));
  data = decryptMaybe(data);
  if (!r.ok) {
    const msg = data?.error?.message || data?.message || data?.detail || data?.error || `HTTP ${r.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = r.status;
    err.code = data?.error?.code || data?.code || `HTTP_${r.status}`;
    err.data = data;
    throw err;
  }
  return data;
}

/* ---------- account ---------- */

export async function getProfile() {
  return api("/users/me");
}

export async function getBalance() {
  const me = await getProfile();
  const u = me.user || me.data || me;
  const bal = u.balance ?? u.wallet ?? u.credit ?? me.balance ?? null;
  return { ok: true, balance: bal != null ? Number(bal) : null, profile: u };
}

/* ---------- catalogue (cached, stale-while-revalidate) ---------- */

const TTL_MS = 90_000;
let _cache = { at: 0, data: null };
let _inflight = null;

async function fetchCatalog() {
  const data = await api("/games");
  _cache = { at: Date.now(), data };
  return data;
}

export async function listGames() {
  const now = Date.now();
  if (_cache.data && now - _cache.at < TTL_MS) return _cache.data;
  if (_cache.data && now - _cache.at < TTL_MS * 4) {
    if (!_inflight) {
      _inflight = fetchCatalog().finally(() => {
        _inflight = null;
      });
      _inflight.catch(() => {});
    }
    return _cache.data;
  }
  if (_inflight) {
    try {
      return await _inflight;
    } catch {
      /* fall through */
    }
  }
  return fetchCatalog();
}

export async function getGame(code) {
  return api(`/games/${encodeURIComponent(code)}`);
}

export function warmFoxProducts() {
  if (!isFoxReady()) return;
  listGames().catch((e) => console.warn("[fox] warm failed:", e.message));
  setInterval(() => {
    if (isFoxReady()) listGames().catch(() => {});
  }, TTL_MS).unref?.();
}

/** Normalize API payload → [{ slug, name, packs: [...] }] */
export function normalizeGamesPayload(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  let list =
    data.games ||
    data.data?.games ||
    (Array.isArray(data.data) ? data.data : null) ||
    (Array.isArray(data) ? data : null);
  if (!list && (data.code || data.items)) list = [data.game || data];
  if (!Array.isArray(list)) list = [];

  for (const g of list) {
    if (!g || typeof g !== "object") continue;
    const slug = String(g.code || g.id || g.slug || "").trim();
    let items = g.items || g.packages || g.products || g.packs || [];
    if (!Array.isArray(items)) items = [];
    const packs = items
      .map((p) => {
        const price = Number(p.price ?? p.reseller_price ?? p.cost ?? p.amount ?? NaN);
        return {
          id: String(p.code ?? p.id ?? p.item_code ?? ""),
          name: String(p.name || p.title || p.label || p.code || ""),
          cost: price,
          price,
          category: String(p.category || p.group || "Diamonds"),
          inStock:
            p.available !== false && p.in_stock !== false && p.open !== false && p.active !== false && p.unavailable !== true,
          image: String(p.image || p.icon || ""),
        };
      })
      .filter((p) => p.id && Number.isFinite(p.cost));

    const fields = g.fields || g.inputs || g.required_fields || g.required_inputs || [];
    const fieldNames = (Array.isArray(fields) ? fields : Object.keys(fields || {})).map((f) =>
      String(typeof f === "string" ? f : f?.name || f?.key || "").toLowerCase(),
    );
    const needsZone =
      !!(g.needs_zone_id || g.needsZone || g.requires_server) ||
      fieldNames.some((n) => /zone|server/.test(n));

    if (!slug || !packs.length) continue;
    out.push({
      slug,
      name: String(g.name || g.title || slug),
      open: g.open !== false && g.active !== false && g.enabled !== false,
      needsZone,
      packs,
      provider: "fox",
      image: String(g.image || g.icon || g.logo || ""),
    });
  }
  return out;
}

/* ---------- player lookup + orders ---------- */

export async function checkId(game, playerId, zoneId) {
  const body = { player_id: String(playerId) };
  if (zoneId) body.zone_id = String(zoneId);
  return api(`/games/${encodeURIComponent(game)}/lookup`, { method: "POST", body, encrypted: true });
}

export async function placeOrder({ game, product, playerId, zoneId, quantity, reference }) {
  const body = {
    game_code: String(game),
    item_code: String(product),
    player_id: String(playerId),
    reference: String(reference),
  };
  if (zoneId) body.zone_id = String(zoneId);
  if (quantity && Number(quantity) > 1) body.quantity = Number(quantity);
  return api("/orders", { method: "POST", body, signed: true });
}

export async function getOrder(idOrRef) {
  return api(`/orders/${encodeURIComponent(idOrRef)}`, { signed: true });
}

export async function listOrders() {
  return api("/orders", { signed: true });
}

/** Webhook: X-Fox-Signature: sha256=<hmac> — HMAC-SHA256 of the RAW body with webhook_secret */
export function verifyWebhookSignature(rawBody, signature, whSecret) {
  if (!whSecret || !signature) return false;
  const want = crypto.createHmac("sha256", whSecret).update(rawBody).digest("hex");
  const got = String(signature).replace(/^sha256=/i, "").trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
  } catch {
    return false;
  }
}

/** order lifecycle: queued → processing → success / partial / failed / refunded */
export function summarizeFoxStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "success") return { status: "done", done: true };
  if (s === "partial") return { status: "partial", done: true };
  if (s === "failed" || s === "refunded") return { status: "failed", done: true };
  return { status: "processing", done: false };
}
