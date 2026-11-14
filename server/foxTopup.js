/**
 * TopupFox Reseller API — based on official reseller_client.mjs
 * Base: https://api.topupfoxbot.com/v1
 *
 * Env:
 *   FOX_TOPUP_UID         reseller id (X-Uid)
 *   FOX_TOPUP_API_KEY     api key
 *   FOX_TOPUP_API_SECRET  api secret (AES + HMAC)
 *
 * AES key = SHA256("fox-transport-v1:" + api_secret)
 * Envelope: { _enc:1, token: apiKey, data: base64url(nonce12 || ct || tag16) }
 */
import crypto from "crypto";

const BASE = (process.env.FOX_TOPUP_URL || "https://api.topupfoxbot.com/v1").replace(/\/$/, "");

function creds() {
  const raw = (process.env.FOX_TOPUP_API_KEY || process.env.FOX_API_KEY || "").trim();
  const parts = raw.split(":").map((x) => x.trim()).filter(Boolean);
  let u = "", k = raw, sec = "";
  if (parts.length === 2) [u, k] = parts;
  else if (parts.length >= 3) [u, k, sec] = parts;
  return {
    uid: (process.env.FOX_TOPUP_UID || process.env.FOX_UID || u || "").trim(),
    key: k,
    secret: (process.env.FOX_TOPUP_API_SECRET || process.env.FOX_API_SECRET || sec || "").trim(),
  };
}
const uid = () => creds().uid;
const key = () => creds().key;
const secret = () => creds().secret;

export function isFoxReady() {
  return Boolean(uid() && key() && secret());
}
export function isFoxSigningReady() {
  return isFoxReady();
}

function aesKey() {
  return crypto.createHash("sha256").update(`fox-transport-v1:${secret()}`).digest();
}

function enc(obj) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), nonce);
  const plain = Buffer.from(JSON.stringify(obj));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([nonce, ciphertext, tag]).toString("base64url");
  return { _enc: 1, token: key(), data };
}

function dec(obj) {
  if (!obj || obj._enc !== 1) return obj;
  const buf = Buffer.from(obj.data, "base64url");
  if (buf.length <= 28) throw Object.assign(new Error("Invalid encrypted payload"), { code: "DECRYPT_FAILED" });
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), nonce);
  decipher.setAuthTag(tag);
  try {
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString());
  } catch (e) {
    throw Object.assign(new Error("Fox decrypt failed: " + (e.message || "bad secret")), {
      code: "DECRYPT_FAILED",
    });
  }
}

function basePath() {
  try {
    return new URL(BASE).pathname.replace(/\/+$/, "") || "/v1";
  } catch {
    return "/v1";
  }
}

function sign(method, path, business = {}) {
  const sorted = Object.fromEntries(Object.entries(business).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const bodyStr = method === "GET" ? "" : JSON.stringify(sorted);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const reqTime = String(Date.now());
  const nonce = crypto.randomUUID();
  const msg = [method, basePath() + path, bodyHash, reqTime, nonce, key()].join("\n");
  const signature = crypto.createHmac("sha256", secret()).update(msg).digest("hex");
  return { ...business, req_time: reqTime, nonce, hash: bodyHash, token: key(), signature };
}

async function apiGet(path, { signed = false } = {}) {
  if (!isFoxReady()) {
    throw Object.assign(new Error("FOX_TOPUP_UID / API_KEY / API_SECRET not set"), { code: "not_configured" });
  }
  const headers = { "X-Uid": String(uid()), Accept: "application/json" };
  let url = `${BASE}${path}`;
  if (signed) {
    const p = sign("GET", path, {});
    url +=
      "?" +
      new URLSearchParams({
        req_time: p.req_time,
        nonce: p.nonce,
        hash: p.hash,
        token: p.token,
        signature: p.signature,
      });
  } else {
    headers["X-Api-Key"] = key();
  }
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const raw = await r.json().catch(() => ({}));
  let data;
  try {
    data = dec(raw);
  } catch (e) {
    if (!r.ok) {
      const err = new Error(`Fox HTTP ${r.status} (decrypt also failed — check API_SECRET)`);
      err.status = r.status;
      err.code = "HTTP_" + r.status;
      throw err;
    }
    throw e;
  }
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

async function apiPost(path, body = {}, { signed = false } = {}) {
  if (!isFoxReady()) {
    throw Object.assign(new Error("FOX_TOPUP_UID / API_KEY / API_SECRET not set"), { code: "not_configured" });
  }
  const headers = {
    "X-Uid": String(uid()),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let payload;
  if (signed) {
    payload = enc(sign("POST", path, body));
  } else {
    headers["X-Api-Key"] = key();
    payload = enc(body);
  }
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35000),
  });
  const raw = await r.json().catch(() => ({}));
  let data;
  try {
    data = dec(raw);
  } catch (e) {
    if (!r.ok) {
      const err = new Error(`Fox HTTP ${r.status} (decrypt also failed — check API_SECRET)`);
      err.status = r.status;
      err.code = "HTTP_" + r.status;
      throw err;
    }
    throw e;
  }
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

/* ---------- account / catalog ---------- */

export async function getProfile() {
  return apiGet("/users/me");
}

/** Walk object for first numeric balance-like field */
function pickBalance(obj, depth = 0) {
  if (obj == null || depth > 5) return null;
  if (typeof obj === "number" && Number.isFinite(obj)) return obj;
  if (typeof obj === "string") {
    const n = Number(String(obj).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof obj !== "object") return null;
  const prefer = [
    "balance",
    "wallet_balance",
    "walletBalance",
    "available_balance",
    "availableBalance",
    "credit",
    "credits",
    "amount",
    "usd",
    "money",
  ];
  for (const k of prefer) {
    if (obj[k] != null && typeof obj[k] !== "object") {
      const n = pickBalance(obj[k], depth + 1);
      if (n != null) return n;
    }
  }
  // nested wallet / account objects
  for (const k of ["wallet", "account", "user", "data", "profile", "reseller"]) {
    if (obj[k] && typeof obj[k] === "object") {
      const n = pickBalance(obj[k], depth + 1);
      if (n != null) return n;
    }
  }
  return null;
}

export async function getBalance() {
  const tried = [];
  let me = null;
  let bal = null;
  let source = "";

  // 1) /users/me
  try {
    me = await getProfile();
    tried.push({ path: "/users/me", ok: true });
    bal = pickBalance(me);
    if (bal != null) source = "/users/me";
  } catch (e) {
    tried.push({ path: "/users/me", ok: false, error: e.message });
  }

  // 2) alternate endpoints if still null
  if (bal == null) {
    for (const path of ["/wallet", "/balance", "/account", "/users/me/wallet"]) {
      try {
        const d = await apiGet(path);
        tried.push({ path, ok: true });
        const n = pickBalance(d);
        if (n != null) {
          bal = n;
          source = path;
          if (!me) me = d;
          break;
        }
      } catch (e) {
        tried.push({ path, ok: false, error: e.message || String(e.code || e.status || "") });
      }
    }
  }

  // If still null but profile has explicit 0
  if (bal == null && me) {
    const u = me.user || me.data || me;
    if (u.balance === 0 || u.wallet === 0 || u.credit === 0) {
      bal = 0;
      source = "explicit-zero";
    }
  }

  const u = (me && (me.user || me.data || me)) || {};
  return {
    ok: true,
    balance: bal != null && Number.isFinite(Number(bal)) ? Number(bal) : null,
    source,
    profile: {
      id: u.id || u.uid || u.user_id || null,
      username: u.username || u.name || u.email || null,
      email: u.email || null,
      // small raw snapshot for admin debug (no secrets)
      rawKeys: u && typeof u === "object" ? Object.keys(u).slice(0, 20) : [],
      rawBalanceFields: {
        balance: u.balance,
        wallet: typeof u.wallet === "object" ? u.wallet : u.wallet,
        credit: u.credit,
        credits: u.credits,
      },
    },
    tried,
  };
}

const TTL_MS = 90_000;
let _cache = { at: 0, data: null };
let _inflight = null;

async function fetchCatalog() {
  const data = await apiGet("/games");
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

export async function listProductsCached() {
  return listGames();
}

export async function getGame(code) {
  return apiGet(`/games/${encodeURIComponent(code)}`);
}

export function warmFoxProducts() {
  if (!isFoxReady()) return;
  listGames().catch((e) => console.warn("[fox] warm failed:", e.message));
  setInterval(() => {
    if (isFoxReady()) listGames().catch(() => {});
  }, TTL_MS).unref?.();
}

export function normalizeGamesPayload(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  let list =
    (Array.isArray(data) ? data : null) ||
    data.games ||
    data.data?.games ||
    (Array.isArray(data.data) ? data.data : null);
  if (!list && (data.code || data.items)) list = [data.game || data];
  if (!Array.isArray(list)) list = [];

  for (const g of list) {
    if (!g || typeof g !== "object") continue;
    const slug = String(g.code || g.id || g.slug || "").trim();
    let items = g.items || g.packages || g.products || g.packs || [];
    if (!Array.isArray(items)) items = [];
    const packs = items
      .map((p) => {
        const price = Number(p.reseller_price ?? p.price ?? p.cost ?? p.amount ?? NaN);
        return {
          id: String(p.code ?? p.id ?? p.item_code ?? ""),
          name: String(p.name || p.title || p.label || p.code || ""),
          cost: price,
          price,
          category: String(p.category || p.group || "Diamonds"),
          inStock:
            p.available !== false &&
            p.in_stock !== false &&
            p.open !== false &&
            p.active !== false &&
            p.unavailable !== true,
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
      id: `fox_${slug}`,
      foxId: slug,
      name: String(g.name || g.title || slug),
      nameKm: String(g.name || g.title || slug),
      open: g.open !== false && g.active !== false && g.enabled !== false,
      needsZone,
      packs,
      provider: "fox",
      image: String(g.image || g.icon || g.logo || ""),
      mark: String(g.name || slug).slice(0, 2).toUpperCase(),
      hue: 25,
    });
  }
  return out;
}

/* ---------- lookup + orders ---------- */

export async function checkId(game, playerId, zoneId) {
  const input_values = { player_id: String(playerId) };
  if (zoneId) input_values.server_id = String(zoneId);
  return apiPost(`/games/${encodeURIComponent(game)}/lookup`, { input_values });
}

export async function placeOrder({
  gameCode,
  itemCode,
  gameItemId,
  playerId,
  serverId,
  reference,
  extra = {},
} = {}) {
  const body = { ...extra, reference: reference || crypto.randomUUID() };
  if (playerId) body.player_id = String(playerId);
  if (serverId) body.server_id = String(serverId);
  if (gameItemId != null) body.game_item_id = gameItemId;
  else {
    body.game_code = gameCode;
    body.item_code = itemCode;
  }
  return apiPost("/orders", body, { signed: true });
}

export async function getOrder(idOrRef) {
  return apiGet(`/orders/${encodeURIComponent(idOrRef)}`, { signed: true });
}

export async function listOrders() {
  return apiGet("/orders", { signed: true });
}

export function summarizeFoxStatus(status) {
  const s = String(status || "").toLowerCase();
  return {
    done: ["success", "completed", "done", "delivered"].includes(s),
    failed: ["failed", "error", "cancelled", "canceled", "refunded"].includes(s),
    pending: ["queued", "pending", "processing", "partial"].includes(s),
    raw: status,
  };
}
