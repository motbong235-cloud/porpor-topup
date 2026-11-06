/**
 * Rate limiting, IP extraction, login lockout, payment-bypass guards, edge-hardening.
 * In-memory (per Render instance). Pair with Cloudflare (Proxied + WAF + Rate Limit) for DDoS.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const buckets = new Map(); // key -> { count, resetAt }
const loginFails = new Map(); // ip -> { n, lockUntil }
const recentHits = new Map(); // ip -> number[] timestamps (short window flood)

function now() {
  return Date.now();
}

/** Client IP behind Render / Cloudflare / nginx */
export function clientIp(req) {
  // req.ip honours Express "trust proxy" (TRUST_PROXY env). Never trust raw X-Forwarded-For alone.
  return String(req.ip || req.socket?.remoteAddress || "").trim().slice(0, 64) || "unknown";
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
      auditLog("rate_limited", { name, ip, path: req.path, ua: clientUa(req).slice(0, 80) });
      return res.status(429).json({ error: "rate_limited", retryAfter: r.retryAfter });
    }
    next();
  };
}

/**
 * Global per-IP shield for all /api traffic (cheap flood filter before heavy handlers).
 * Default: 120 req / 60s + burst 25 / 5s
 */
export function globalApiShield(opts = {}) {
  const perMin = Number(opts.perMin) || 120;
  const burst = Number(opts.burst) || 25;
  const burstMs = Number(opts.burstMs) || 5_000;
  return (req, res, next) => {
    const ip = clientIp(req);
    const r1 = rateLimit(`global:${ip}`, { limit: perMin, windowMs: 60_000 });
    if (!r1.ok) {
      res.setHeader("Retry-After", String(r1.retryAfter));
      return res.status(429).json({ error: "rate_limited", retryAfter: r1.retryAfter });
    }
    const t = now();
    let arr = recentHits.get(ip);
    if (!arr) arr = [];
    arr = arr.filter((x) => t - x < burstMs);
    arr.push(t);
    recentHits.set(ip, arr);
    if (arr.length > burst) {
      res.setHeader("Retry-After", "5");
      auditLog("burst_limited", { ip, path: req.path, n: arr.length });
      return res.status(429).json({ error: "rate_limited", retryAfter: 5 });
    }
    next();
  };
}

/** Reject empty / obvious scripted probes on sensitive methods (soft). */
export function softBotGate(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const ua = clientUa(req);
  const path = String(req.path || "");
  // Allow server-to-server webhooks without UA
  if (path.startsWith("/api/webhook/")) return next();
  if (!ua || ua.length < 8) {
    const ip = clientIp(req);
    const r = rateLimit(`no_ua:${ip}`, { limit: 15, windowMs: 60_000 });
    if (!r.ok) {
      return res.status(429).json({ error: "rate_limited", retryAfter: r.retryAfter });
    }
  }
  // Block common scanner paths early (no route match needed)
  const p = String(req.url || "").toLowerCase();
  if (
    p.includes("/wp-admin") ||
    p.includes("/wp-login") ||
    p.includes("/.env") ||
    p.includes("/phpmyadmin") ||
    p.includes("/xmlrpc.php")
  ) {
    auditLog("probe_blocked", { ip: clientIp(req), path: p.slice(0, 120) });
    return res.status(404).end();
  }
  next();
}

/** Standard browser security headers */
export function securityHeaders(isProd = false) {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (isProd) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' https://telegram.org https://oauth.telegram.org",
        "frame-src 'self' https://oauth.telegram.org https://telegram.org https://www.youtube.com https://www.youtube-nocookie.com",
        "media-src 'self' https: blob:",
        "connect-src 'self' https://telegram.org https://oauth.telegram.org",
        "form-action 'self' https://oauth.telegram.org",
      ].join("; "),
    );
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
  for (const [k, arr] of recentHits) {
    const next = (arr || []).filter((x) => t - x < 10_000);
    if (!next.length) recentHits.delete(k);
    else recentHits.set(k, next);
  }
}, 5 * 60_000).unref?.();

/**
 * Never trust the browser to say "I paid".
 * Only ABA PayWay checkPayment (or admin) may advance pending → paid.
 */
export function assertPaymentProviderPaid(pay) {
  return !!(pay && pay.paid === true);
}

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
