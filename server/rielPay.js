/**
 * RielPay (rielpays.com) — KHQR gateway
 * POST /v1/payments  Authorization: Bearer sk_…
 * GET  /v1/payments/:id
 * Webhook: X-Webhook-Signature + RIELPAY_WEBHOOK_SECRET
 *
 * Env / settings: RIELPAY_API_KEY, RIELPAY_WEBHOOK_SECRET, RIELPAY_BASE_URL
 */
import crypto from "crypto";

const DEFAULT_BASE = "https://rielpays.com";

function clean(v) {
  return String(v || "")
    .replace(/[\s\u200b\ufeff]+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "");
}

function baseUrl() {
  return clean(process.env.RIELPAY_BASE_URL || DEFAULT_BASE).replace(/\/$/, "") || DEFAULT_BASE;
}

let _getSettings = null;
/** Wire getSettings from server/index.js so Admin-saved keys work without restart issues. */
export function bindSettings(fn) {
  _getSettings = typeof fn === "function" ? fn : null;
}

function settingsBag() {
  try {
    return (_getSettings && _getSettings()) || {};
  } catch {
    return {};
  }
}

/**
 * @param {"settings"|"env"|"auto"} source
 * - settings: Admin Settings (TikTok Khmer only)
 * - env: Render RIELPAY_API_KEY (Porpor main)
 * - auto: env only (do not mix TikTok merchant key)
 */
export function apiKey(source = "auto") {
  const fromAdmin = clean(settingsBag().rielpayApiKey || "");
  const fromEnv = clean(process.env.RIELPAY_API_KEY || "");
  if (source === "settings") return fromAdmin;
  if (source === "env") return fromEnv;
  return fromEnv;
}

export function webhookSecret(source = "auto") {
  const fromAdmin = clean(settingsBag().rielpayWebhookSecret || "");
  const fromEnv = clean(process.env.RIELPAY_WEBHOOK_SECRET || "");
  if (source === "settings") return fromAdmin;
  if (source === "env") return fromEnv;
  // Prefer env; fall back to admin so TikTok webhooks still verify
  return fromEnv || fromAdmin;
}

/** Secrets to try when verifying webhooks (order/env + TikTok settings). */
export function webhookSecrets() {
  const a = clean(settingsBag().rielpayWebhookSecret || "");
  const e = clean(process.env.RIELPAY_WEBHOOK_SECRET || "");
  return [...new Set([e, a].filter(Boolean))];
}

export function isReady(source = "auto") {
  return apiKey(source).length >= 8;
}

async function qrImageFromString(qrString) {
  if (!qrString) return "";
  const s = String(qrString);
  if (s.startsWith("data:image")) return s;
  if (/^https?:\/\//i.test(s) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(s)) return s;
  try {
    const url =
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=" +
      encodeURIComponent(s);
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    const b64 = buf.toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=" +
      encodeURIComponent(s)
    );
  }
}

/**
 * Create KHQR payment.
 * @returns {{ success, transaction_id, qr_image, qr_string, pay_url, deeplink, open_aba_url, expires_at, raw, error }}
 */
export async function createPayment(amount, orderId, description = "", opts = {}) {
  const keySource = opts.keySource === "settings" || opts.keySource === "env" ? opts.keySource : "auto";
  const key = apiKey(keySource);
  if (!key) {
    const hint =
      keySource === "settings"
        ? "set ABA PayWay API Key in Admin Settings (TikTok Khmer)"
        : keySource === "env"
          ? "set RIELPAY_API_KEY on Render (other services)"
          : "set Admin Settings key or RIELPAY_API_KEY on Render";
    return { success: false, error: `ABA PayWay API key missing — ${hint}`, keySource };
  }
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt > 0)) return { success: false, error: "invalid_amount" };

  const body = {
    amount: amt,
    currency: "USD",
    description: String(description || `Order ${orderId}`).slice(0, 120),
    metadata: { order_id: String(orderId) },
  };

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Idempotency-Key": `porpor-${String(orderId)}`.slice(0, 64),
    "User-Agent": "PorporTopup-RielPay/1.0",
  };

  let lastErr = "unknown";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`${baseUrl()}/v1/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.RIELPAY_TIMEOUT || 18) * 1000),
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        lastErr = `HTTP ${r.status} non-JSON: ${text.slice(0, 180)}`;
        if (r.status >= 500 && attempt < 2) {
          await new Promise((x) => setTimeout(x, 800 * attempt));
          continue;
        }
        return { success: false, error: lastErr, raw: text.slice(0, 400) };
      }
      if (data && data.data && typeof data.data === "object") data = data.data;

      if (r.status >= 400) {
        const errObj = data?.error;
        const errCode =
          (errObj && typeof errObj === "object" && errObj.code) ||
          data?.code ||
          "";
        const errMsg =
          (errObj && typeof errObj === "object" && errObj.message) ||
          (typeof errObj === "string" ? errObj : "") ||
          data?.message ||
          "";
        lastErr = errCode && errMsg
          ? `${errCode}: ${errMsg}`
          : errMsg || errCode || `HTTP ${r.status}`;
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
          await new Promise((x) => setTimeout(x, 1000 * attempt));
          continue;
        }
        return {
          success: false,
          error: String(lastErr),
          code: String(errCode || ""),
          raw: data,
        };
      }

      const id = data.id || data.payment_id || data.transaction_id || "";
      const qrString =
        data.qr_string || data.qrString || data.qr_code || data.qr || data.khqr || "";
      let qrImage =
        data.qr_image || data.qrImage || data.image || data.card_image || "";
      if (!qrImage && qrString) {
        qrImage = await qrImageFromString(qrString);
      }
      const payUrl = data.checkout_url || data.pay_url || data.url || "";
      const deeplink = data.deeplink || data.aba_deeplink || data.open_aba || "";

      if (!id && !qrString && !payUrl) {
        return { success: false, error: "unexpected response", raw: data };
      }

      return {
        success: true,
        transaction_id: String(id),
        qr_image: qrImage,
        qr_string: String(qrString || ""),
        pay_url: String(payUrl || ""),
        deeplink: String(deeplink || ""),
        open_aba_url: String(deeplink || ""),
        expires_at: data.expires_at || data.expire_at || null,
        gateway: "rielpay",
        keySource,
        raw: data,
      };
    } catch (e) {
      lastErr = `${e.name || "Error"}: ${e.message}`;
      if (attempt < 2) {
        await new Promise((x) => setTimeout(x, 1000 * attempt));
        continue;
      }
    }
  }
  return { success: false, error: lastErr, keySource };
}

/**
 * @returns {{ paid: boolean, status: string, amount?: number, raw?: object }}
 */
export async function checkPayment(paymentId, opts = {}) {
  const keySource = opts.keySource === "settings" || opts.keySource === "env" ? opts.keySource : "auto";
  const keysToTry = [];
  if (keySource === "auto") {
    for (const s of ["settings", "env"]) {
      const k = apiKey(s);
      if (k && !keysToTry.includes(k)) keysToTry.push(k);
    }
  } else {
    const k = apiKey(keySource);
    if (k) keysToTry.push(k);
  }
  if (!keysToTry.length || !paymentId) {
    return { paid: false, status: "no_key" };
  }
  let last = { paid: false, status: "unknown" };
  for (const key of keysToTry) {
    try {
      const r = await fetch(`${baseUrl()}/v1/payments/${encodeURIComponent(paymentId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "User-Agent": "PorporTopup-RielPay/1.0",
        },
        signal: AbortSignal.timeout(20000),
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        last = { paid: false, status: `http_${r.status}`, raw: { text: text.slice(0, 200) } };
        continue;
      }
      if (data && data.data && typeof data.data === "object") data = data.data;
      const status = String(data.status || data.payment_status || "").toLowerCase();
      const paid =
        status === "paid" ||
        status === "succeeded" ||
        status === "success" ||
        status === "completed" ||
        !!data.paid;
      if (r.status === 401 || r.status === 403) {
        last = { paid: false, status: `http_${r.status}` };
        continue;
      }
      return {
        paid,
        status: status || (paid ? "paid" : "pending"),
        amount: data.amount != null ? Number(data.amount) : undefined,
        raw: data,
      };
    } catch (e) {
      last = { paid: false, status: "error", raw: { error: e.message } };
    }
  }
  return last;
}

/** Verify webhook signature (HMAC-SHA256 of raw body). Tries env + TikTok settings secrets. */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secrets = webhookSecrets();
  if (!secrets.length) return { ok: false, error: "no_webhook_secret" };
  const sig = String(signatureHeader || "").trim();
  if (!sig) return { ok: false, error: "missing_signature" };
  const body = typeof rawBody === "string" ? rawBody : Buffer.from(rawBody || "").toString("utf8");
  const candidates = [sig, sig.replace(/^sha256=/i, ""), sig.replace(/^v1=/i, "")];
  for (const secret of secrets) {
    const expected = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    for (const c of candidates) {
      try {
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(c, "hex");
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true };
      } catch {}
      if (c === expected) return { ok: true };
    }
    try {
      const b64 = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
      if (candidates.includes(b64)) return { ok: true };
    } catch {}
  }
  return { ok: false, error: "invalid_signature" };
}

export async function diagnose() {
  const info = {
    readyEnv: isReady("env"),
    readyTikTokSettings: isReady("settings"),
    keyLengthEnv: apiKey("env").length,
    keyLengthTikTok: apiKey("settings").length,
    baseUrl: baseUrl(),
    hasWebhookSecret: webhookSecrets().length > 0,
    note: "settings key = TikTok Khmer only; env key = other services",
  };
  const out = { ...info };
  if (isReady("settings")) {
    out.testSettings = await createPayment(0.05, `diag-ttk-${Date.now()}`, "TikTok Khmer payment test", {
      keySource: "settings",
    });
  }
  if (isReady("env")) {
    out.testEnv = await createPayment(0.05, `diag-env-${Date.now()}`, "Env / other services test", {
      keySource: "env",
    });
  }
  out.test = out.testEnv || out.testSettings || null;
  out.testScope = out.testEnv ? "env" : out.testSettings ? "tiktok_settings" : null;
  if (!out.test) out.error = "missing_key";
  return out;
}
