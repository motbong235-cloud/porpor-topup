/**
 * Robux Send — Group Payout helper (Porpor)
 * Settings (Admin → Settings):
 *   robuxAutoEnabled, robuxCookie, robuxGroupId, robuxTotpSecret
 *
 * Note: Roblox may return 403 "Challenge required" (Arkose). In that case
 * auto fails and order stays queued for manual payout in browser.
 */
import crypto from "crypto";
import { getSettings, updateSettings } from "./store.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cookieHeader(cookie) {
  const c = String(cookie || "").trim();
  if (!c) return "";
  return c.startsWith(".ROBLOSECURITY=") ? c : `.ROBLOSECURITY=${c}`;
}

function getCfg() {
  const s = getSettings() || {};
  return {
    enabled: !!s.robuxAutoEnabled,
    cookie: String(s.robuxCookie || "").trim(),
    groupId: String(s.robuxGroupId || "").trim(),
    totpSecret: String(s.robuxTotpSecret || "").trim().replace(/\s+/g, ""),
  };
}

export function isRobuxAutoReady() {
  const c = getCfg();
  return c.enabled && !!c.cookie && !!c.groupId;
}

/** Base32 TOTP (RFC 6238) — no external dep */
function totpCode(secretB32, step = 30, digits = 6) {
  const secret = secretB32.replace(/=+$/, "").toUpperCase();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[off] & 0x7f) << 24) |
    ((hmac[off + 1] & 0xff) << 16) |
    ((hmac[off + 2] & 0xff) << 8) |
    (hmac[off + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

async function fetchWithCookie(url, { method = "GET", body, cookie, csrf } = {}) {
  const headers = {
    "User-Agent": UA,
    Accept: "application/json",
    Cookie: cookieHeader(cookie),
  };
  if (csrf) headers["X-CSRF-TOKEN"] = csrf;
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const newCsrf = res.headers.get("x-csrf-token") || csrf;
  // cookie rotation (Set-Cookie) — best-effort parse
  const setCookie = res.headers.getSetCookie?.() || [];
  let nextCookie = cookie;
  for (const sc of setCookie) {
    const m = String(sc).match(/\.ROBLOSECURITY=([^;]+)/);
    if (m) nextCookie = m[1];
  }
  return { status: res.status, json, text, csrf: newCsrf, cookie: nextCookie };
}

async function ensureCsrf(cookie) {
  const r = await fetchWithCookie("https://auth.roblox.com/v2/logout", {
    method: "POST",
    cookie,
  });
  return { csrf: r.csrf || "", cookie: r.cookie || cookie };
}

/**
 * Check group funds (0 balance often returns 404).
 */
export async function checkGroupFunds() {
  const cfg = getCfg();
  if (!cfg.cookie || !cfg.groupId) {
    return { ok: false, error: "missing_cookie_or_group" };
  }
  try {
    const { csrf, cookie } = await ensureCsrf(cfg.cookie);
    if (cookie !== cfg.cookie) {
      try {
        updateSettings({ robuxCookie: cookie });
      } catch {}
    }
    const r = await fetchWithCookie(
      `https://economy.roblox.com/v1/groups/${cfg.groupId}/currency`,
      { cookie, csrf },
    );
    if (r.status === 404) {
      return { ok: true, robux: 0, note: "Group funds 0 or not found" };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: "unauthorized", status: r.status, detail: r.json || r.text };
    }
    const robux = Number(r.json?.robux ?? r.json?.Robux ?? 0);
    return { ok: true, robux, status: r.status };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Attempt one-time group payout to recipient userId.
 * amount = Robux integer (what leaves group; recipient gets less after tax).
 */
export async function groupPayout({ recipientUserId, amount }) {
  const cfg = getCfg();
  if (!isRobuxAutoReady()) {
    return { ok: false, error: "auto_disabled_or_not_configured" };
  }
  const userId = Number(recipientUserId);
  const robux = Math.floor(Number(amount) || 0);
  if (!userId || robux < 1) {
    return { ok: false, error: "invalid_recipient_or_amount" };
  }

  try {
    let { csrf, cookie } = await ensureCsrf(cfg.cookie);
    if (cookie !== cfg.cookie) {
      try {
        updateSettings({ robuxCookie: cookie });
      } catch {}
    }

    const url = `https://groups.roblox.com/v1/groups/${cfg.groupId}/payouts`;
    const body = {
      PayoutType: "FixedAmount",
      Recipients: [
        {
          recipientId: userId,
          recipientType: "User",
          amount: robux,
        },
      ],
    };

    let r = await fetchWithCookie(url, { method: "POST", body, cookie, csrf });
    if (r.status === 403 && r.csrf) {
      r = await fetchWithCookie(url, { method: "POST", body, cookie: r.cookie, csrf: r.csrf });
    }

    // Challenge / 2FA gate
    if (r.status === 403 || r.status === 401) {
      const msg = JSON.stringify(r.json || r.text || "").slice(0, 400);
      if (/challenge/i.test(msg) && cfg.totpSecret) {
        return {
          ok: false,
          error: "challenge_required",
          hint: "Roblox Arkose/2FA challenge — complete payout in browser Revenue → Payouts, or refresh cookie after browser login",
          detail: msg,
        };
      }
      return { ok: false, error: "forbidden", status: r.status, detail: msg };
    }

    if (r.status >= 200 && r.status < 300) {
      if (r.cookie && r.cookie !== cfg.cookie) {
        try {
          updateSettings({ robuxCookie: r.cookie });
        } catch {}
      }
      return { ok: true, status: r.status };
    }

    return {
      ok: false,
      error: "payout_failed",
      status: r.status,
      detail: (r.json && JSON.stringify(r.json)) || String(r.text || "").slice(0, 300),
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Parse pack name / note for Robux amount (e.g. "100 Robux", "80 R$").
 */
export function parseRobuxAmount(order) {
  const texts = [order?.packName, order?.note, order?.gameName, String(order?.qty || "")]
    .filter(Boolean)
    .join(" ");
  const m = texts.match(/(\d[\d,]*)\s*(robux|r\$|rbx)/i);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10) || 0;
  // fallback: some packs encode amount in packId
  const n = Number(order?.robuxAmount || order?.packRobux || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function tryAutoRobuxSend(order) {
  if (!isRobuxAutoReady()) {
    return { ok: false, skipped: true, error: "not_ready" };
  }
  const recipient =
    order.rbxUserId ||
    order.robloxUserId ||
    (String(order.userId || "").match(/^\d+$/) ? order.userId : null);
  if (!recipient) {
    return { ok: false, error: "no_roblox_user_id — run profile check first" };
  }
  const amount = parseRobuxAmount(order);
  if (amount < 1) {
    return { ok: false, error: "could_not_parse_robux_amount_from_pack" };
  }
  return groupPayout({ recipientUserId: recipient, amount });
}
