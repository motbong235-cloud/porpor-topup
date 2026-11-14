/**
 * TopupFox (topupfoxbot.com) Reseller API
 * Base: https://api.topupfoxbot.com/v1
 * Auth headers: X-Uid, X-Api-Key
 * Signed routes: HMAC-SHA256 with api_secret
 * Encrypted routes/responses: AES-256-GCM (key = SHA256(api_secret))
 *
 * Env:
 *   FOX_TOPUP_UID        — numeric uid from Fox dashboard
 *   FOX_TOPUP_API_KEY    — api key
 *   FOX_TOPUP_API_SECRET — api secret (signing + transport crypto)
 *   FOX_TOPUP_URL        — optional override (default api.topupfoxbot.com/v1)
 */
import crypto from "crypto";

const BASE = (process.env.FOX_TOPUP_URL || "https://api.topupfoxbot.com/v1").replace(/\/$/, "");

function uid() {
  return String(process.env.FOX_TOPUP_UID || process.env.FOX_UID || "").trim();
}
function apiKey() {
  return String(process.env.FOX_TOPUP_API_KEY || process.env.FOX_API_KEY || "").trim();
}
function apiSecret() {
  return String(process.env.FOX_TOPUP_API_SECRET || process.env.FOX_API_SECRET || "").trim();
}

export function isFoxReady() {
  return Boolean(uid() && apiKey() && apiSecret());
}

function transportKey() {
  return crypto.createHash("sha256").update(apiSecret(), "utf8").digest();
}

/** Base64url helpers */
function b64uEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function b64uDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

/** Encrypt JSON body for Encrypted routes → { _enc:1, data } */
export function encryptPayload(obj) {
  const key = transportKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + ciphertext + tag(16)
  return { _enc: 1, data: b64uEncode(Buffer.concat([iv, enc, tag])) };
}

/** Decrypt { _enc:1, data } or pass-through plain JSON */
export function decryptResponse(body) {
  if (!body || typeof body !== "object") return body;
  if (!body._enc || !body.data) return body;
  const key = transportKey();
  const raw = b64uDecode(body.data);
  if (raw.length < 12 + 16) throw new Error("fox: encrypted payload too short");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(12, raw.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

function signBody(rawBody) {
  return crypto.createHmac("sha256", apiSecret()).update(rawBody, "utf8").digest("hex");
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: object, signed?: boolean, encrypted?: boolean }} opts
 */
async function api(path, opts = {}) {
  if (!isFoxReady()) {
    throw Object.assign(new Error("FOX_TOPUP_UID / FOX_TOPUP_API_KEY / FOX_TOPUP_API_SECRET not set"), {
      code: "not_configured",
    });
  }
  const method = String(opts.method || "GET").toUpperCase();
  let payload = opts.body;
  if (opts.encrypted && payload != null) {
    payload = encryptPayload(payload);
  }
  const rawBody = payload != null ? JSON.stringify(payload) : "";
  const headers = {
    "X-Uid": uid(),
    "X-Api-Key": apiKey(),
    Accept: "application/json",
  };
  if (rawBody) headers["Content-Type"] = "application/json";
  if (opts.signed && rawBody) {
    headers["X-Signature"] = signBody(rawBody);
  }

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody || undefined,
    signal: AbortSignal.timeout(method === "POST" ? 40000 : 18000),
  });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  try {
    data = decryptResponse(data);
  } catch (e) {
    if (data?._enc) {
      const err = new Error(`fox decrypt failed: ${e.message}`);
      err.status = r.status;
      err.code = "DECRYPT_FAILED";
      throw err;
    }
  }
  if (!r.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      (typeof data?.error === "string" ? data.error : null) ||
      `HTTP ${r.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = r.status;
    err.code = data?.error?.code || data?.code || `HTTP_${r.status}`;
    err.data = data;
    throw err;
  }
  return data;
}

export async function getMe() {
  return api("/users/me");
}

export async function getBalance() {
  // Fox uses profile balance via /users/me
  const me = await getMe();
  const bal =
    me?.balance ??
    me?.wallet ??
    me?.data?.balance ??
    me?.user?.balance ??
    null;
  return { balance: bal, raw: me };
}

export async function listDeposits() {
  return api("/balance/deposits");
}

export async function listGames() {
  return api("/games");
}

export async function getGame(code) {
  return api(`/games/${encodeURIComponent(code)}`);
}

/** Validate player / server id where the game needs one */
export async function lookup(code, fields = {}) {
  return api(`/games/${encodeURIComponent(code)}/lookup`, {
    method: "POST",
    body: fields,
    encrypted: true,
    signed: true,
  });
}

/**
 * Place order
 * @param {{ gameCode: string, itemCode: string, player_id?: string, server_id?: string, reference?: string }} o
 */
export async function placeOrder(o) {
  const body = {
    game_code: o.gameCode || o.game_code,
    item_code: o.itemCode || o.item_code,
  };
  if (o.player_id || o.playerId) body.player_id = String(o.player_id || o.playerId);
  if (o.server_id || o.serverId) body.server_id = String(o.server_id || o.serverId);
  if (o.reference) body.reference = String(o.reference);
  // alternate field names some SDKs use
  if (!body.game_code && o.gameCode) body.gameCode = o.gameCode;
  if (!body.item_code && o.itemCode) body.itemCode = o.itemCode;

  return api("/orders", {
    method: "POST",
    body,
    signed: true,
    encrypted: true,
  });
}

export async function orderStatus(id) {
  return api(`/orders/${encodeURIComponent(id)}`, { signed: true });
}

export async function listOrders() {
  return api("/orders", { signed: true });
}

/** Normalize Fox games list → [{ id, name, packs }] for storefront */
export function normalizeGamesPayload(data) {
  const out = [];
  const list =
    (Array.isArray(data) && data) ||
    data?.games ||
    data?.data?.games ||
    (Array.isArray(data?.data) && data.data) ||
    [];
  if (!Array.isArray(list)) return out;

  for (const g of list) {
    if (!g || typeof g !== "object") continue;
    const id = String(g.code || g.id || g.slug || "").trim();
    if (!id) continue;
    const name = g.name || g.title || id;
    let items = g.items || g.packages || g.packs || g.products || [];
    if (!Array.isArray(items) && Array.isArray(g.categories)) {
      items = [];
      for (const c of g.categories) {
        for (const it of c.items || c.packages || []) items.push(it);
      }
    }
    const packs = (Array.isArray(items) ? items : []).map((p, i) => {
      const pid = String(p.code || p.item_code || p.id || `p${i}`);
      return {
        id: pid,
        dinoId: pid, // reuse field name used by order path
        foxId: pid,
        name: p.name || p.title || pid,
        nameKm: p.name_km || p.nameKm || p.name || pid,
        price: Number(p.price ?? p.reseller_price ?? p.amount ?? 0),
        cost: Number(p.cost ?? p.price ?? 0),
        image: p.image || p.icon || "",
        badge: p.badge || "",
      };
    });
    out.push({
      id: `fox_${id}`,
      foxId: id,
      dinoId: id,
      name,
      nameKm: g.name_km || g.nameKm || name,
      image: g.image || g.icon || g.logo || "",
      open: true,
      famous: false,
      provider: "fox",
      packs,
      mark: String(name).slice(0, 2).toUpperCase(),
      hue: 210,
    });
  }
  return out;
}

export function summarizeFoxStatus(st) {
  const s = String(st || "").toLowerCase();
  if (["success", "completed", "done", "ok"].includes(s)) return { status: "done", done: true };
  if (["failed", "error", "cancelled", "canceled", "refunded"].includes(s))
    return { status: "failed", done: true };
  if (["partial"].includes(s)) return { status: "partial", done: true };
  if (["queued", "pending", "processing", "in_progress", "review"].includes(s))
    return { status: "processing", done: false };
  return { status: s || "processing", done: false };
}

const CACHE_TTL = 90_000;
let _cache = { at: 0, data: null };

export async function listProductsCached() {
  const now = Date.now();
  if (_cache.data && now - _cache.at < CACHE_TTL) return _cache.data;
  const data = await listGames();
  _cache = { at: now, data };
  return data;
}

export function warmFoxProducts() {
  if (!isFoxReady()) return;
  listProductsCached().catch((e) => console.warn("[fox] warm failed:", e.message));
  setInterval(() => {
    if (!isFoxReady()) return;
    listProductsCached().catch(() => {});
  }, CACHE_TTL).unref?.();
}
