/**
 * Rate limiting, IP extraction, login lockout, payment-bypass guards.
 * In-memory (per Render instance). Good baseline; pair with Cloudflare for edge DDoS.
 */

const buckets = new Map(); // key -> { count, resetAt }
const loginFails = new Map(); // ip -> { n, lockUntil }

function now() {
  return Date.now();
}

/** Client IP behind Render / Cloudflare / nginx */
export function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (xf.length) return xf[0].slice(0, 64);
  const xr = String(req.headers["x-real-ip"] || "").trim();
  if (xr) return xr.slice(0, 64);
  return String(req.ip || req.socket?.remoteAddress || "").slice(0, 64) || "unknown";
}

export function clientUa(req) {
  return String(req.headers["user-agent"] || "").slice(0, 240);
}

/**
 * Sliding window rate limit.
 * @returns {{ ok: true } | { ok: false, retryAfter: number }}
 */
export function rateLimit(key, { limit = 60, windowMs = 60_000 } = {}) {
  const t = now();
  let b = buckets.get(key);
  if (!b || t >= b.resetAt) {
    b = { count: 0, resetAt: t + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) };
  }
  return { ok: true };
}

/** Express middleware factory */
export function limit(name, opts) {
  return (req, res, next) => {
    const ip = clientIp(req);
    const r = rateLimit(`${name}:${ip}`, opts);
    if (!r.ok) {
      res.setHeader("Retry-After", String(r.retryAfter));
      return res.status(429).json({ error: "rate_limited", retryAfter: r.retryAfter });
    }
    next();
  };
}

const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

export function checkLoginAllowed(ip) {
  const row = loginFails.get(ip);
  if (!row) return { ok: true };
  if (row.lockUntil && now() < row.lockUntil) {
    return { ok: false, retryAfter: Math.ceil((row.lockUntil - now()) / 1000) };
  }
  return { ok: true };
}

export function recordLoginFail(ip) {
  const row = loginFails.get(ip) || { n: 0, lockUntil: 0 };
  row.n += 1;
  if (row.n >= MAX_FAILS) {
    row.lockUntil = now() + LOCK_MS;
    row.n = 0;
  }
  loginFails.set(ip, row);
  return row;
}

export function clearLoginFails(ip) {
  loginFails.delete(ip);
}

/** Prune maps occasionally */
setInterval(() => {
  const t = now();
  for (const [k, b] of buckets) {
    if (t >= b.resetAt) buckets.delete(k);
  }
  for (const [k, row] of loginFails) {
    if (row.lockUntil && t >= row.lockUntil && row.n === 0) loginFails.delete(k);
  }
}, 5 * 60_000).unref?.();

/**
 * Never trust the browser to say "I paid".
 * Only ABA PayWay checkPayment (or admin) may advance pending → paid.
 */
export function assertPaymentProviderPaid(pay) {
  return !!(pay && pay.paid === true);
}


import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __secDir = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.DATA_DIR || path.join(__secDir, "..", "data");
const LOG_FILE = path.join(LOG_DIR, "security.log");

/** Append structured security/audit log line */
export function auditLog(event, detail = {}) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...detail,
    });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (e) {
    console.error("[audit]", e.message);
  }
}

export function readAuditLog(limit = 200) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l };
      }
    });
  } catch {
    return [];
  }
}
