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

export function apiKey() {
  // Admin UI disabled — key only from Render / env
  return clean(process.env.RIELPAY_API_KEY);
}

export function webhookSecret() {
  return clean(process.env.RIELPAY_WEBHOOK_SECRET);
}

export function isReady() {
  return apiKey().length >= 8;
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
export async function createPayment(amount, orderId, description = "") {
  const key = apiKey();
  if (!key) {
    return { success: false, error: "RIELPAY_API_KEY missing" };
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
        lastErr =
          data?.message ||
          data?.error ||
          data?.code ||
          `HTTP ${r.status}`;
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
          await new Promise((x) => setTimeout(x, 1000 * attempt));
          continue;
        }
        return { success: false, error: String(lastErr), raw: data };
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
  return { success: false, error: lastErr };
}

/**
 * @returns {{ paid: boolean, status: string, amount?: number, raw?: object }}
 */
export async function checkPayment(paymentId) {
  const key = apiKey();
  if (!key || !paymentId) {
    return { paid: false, status: "no_key" };
  }
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
      return { paid: false, status: `http_${r.status}`, raw: { text: text.slice(0, 200) } };
    }
    if (data && data.data && typeof data.data === "object") data = data.data;
    const status = String(data.status || data.payment_status || "").toLowerCase();
    const paid =
      status === "paid" ||
      status === "succeeded" ||
      status === "success" ||
      status === "completed" ||
      !!data.paid;
    return {
      paid,
      status: status || (paid ? "paid" : "pending"),
      amount: data.amount != null ? Number(data.amount) : undefined,
      raw: data,
    };
  } catch (e) {
    return { paid: false, status: "error", raw: { error: e.message } };
  }
}

/** Verify webhook signature (HMAC-SHA256 of raw body). Supports hex or v1= style. */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, error: "no_webhook_secret" };
  const sig = String(signatureHeader || "").trim();
  if (!sig) return { ok: false, error: "missing_signature" };
  const body = typeof rawBody === "string" ? rawBody : Buffer.from(rawBody || "").toString("utf8");
  const expected = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const candidates = [sig, sig.replace(/^sha256=/i, ""), sig.replace(/^v1=/i, "")];
  for (const c of candidates) {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(c, "hex");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true };
    } catch {}
    if (c === expected) return { ok: true };
  }
  // Some gateways use base64 HMAC
  try {
    const b64 = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
    if (candidates.includes(b64)) return { ok: true };
  } catch {}
  return { ok: false, error: "invalid_signature" };
}

export async function diagnose() {
  const key = apiKey();
  const info = {
    ready: isReady(),
    keyLength: key.length,
    baseUrl: baseUrl(),
    hasWebhookSecret: !!webhookSecret(),
  };
  if (!isReady()) return { ...info, test: null, error: "missing_key" };
  const test = await createPayment(0.05, `diag-${Date.now()}`, "Porpor RielPay test");
  return { ...info, test };
}
