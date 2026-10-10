/**
 * Khmer-System ABA PayWay (Node port of khmer_system.py)
 * Env: ABA_API_KEY, ABA_MERCHANT_ID
 */
const BASE_URL = process.env.KHMER_SYSTEM_URL || "https://khmer-system.com";
const CREATE_URL = `${BASE_URL}/aba-api/generate-qr`;
const CHECK_URL = `${BASE_URL}/aba-api/check-payment`;

/** Env values pasted into Render often carry quotes / spaces / newlines — strip them. */
function clean(v) {
  return String(v || "")
    .replace(/[\s\u200b\ufeff]+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "");
}
function apiKey() {
  return clean(process.env.ABA_API_KEY);
}
function merchantId() {
  return clean(process.env.ABA_MERCHANT_ID);
}

/** Admin-only: call generate-qr with the current env values and report exactly what Khmer System answers. */
export async function diagnose() {
  const rawKey = String(process.env.ABA_API_KEY || "");
  const rawMid = String(process.env.ABA_MERCHANT_ID || "");
  const info = {
    apiKey: { set: !!apiKey(), length: apiKey().length, hadSpacesOrQuotes: rawKey !== apiKey() },
    merchantId: { set: !!merchantId(), value: merchantId(), hadSpacesOrQuotes: rawMid !== merchantId() },
    sameValue: !!apiKey() && apiKey() === merchantId(),
    endpoint: CREATE_URL,
  };
  if (!isPaymentReady()) return { ...info, result: "ABA_API_KEY or ABA_MERCHANT_ID not set" };
  try {
    const r = await fetch(CREATE_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        api_key: apiKey(),
        merchant_id: merchantId(),
        username: "porpor_test",
        amount: 0.01,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 300);
    }
    // never echo the (large) QR image back
    if (body && typeof body === "object") {
      for (const k of ["qr_image", "card_image", "qr"]) if (body[k]) body[k] = `[${String(body[k]).length} chars]`;
    }
    return { ...info, httpStatus: r.status, response: body };
  } catch (e) {
    return { ...info, result: `network error: ${e.message}` };
  }
}

export function isPaymentReady() {
  return Boolean(apiKey() && merchantId());
}

/** Khmer System wants a short "username" label for the payer (the bot sends the Telegram username). */
function makeUsername(raw) {
  const u = String(raw || "").replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
  return u || "customer";
}

/** Browser-like headers — some Khmer System hosts sit behind a WAF that blocks bare clients. */
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/**
 * Create a KHQR payment.
 * Current Khmer System API (same as the working Telegram bot):
 *   POST /aba-api/generate-qr  { api_key, merchant_id, username, amount }
 *   → { ok: true, payment_id, qr_image, card_image, pay_url, expires_at }
 */
export async function createQr(amount, billNumber, username) {
  if (!isPaymentReady()) {
    return {
      success: false,
      error: "ABA_API_KEY or ABA_MERCHANT_ID not set",
      simulation: true,
    };
  }

  const payload = {
    api_key: apiKey(),
    merchant_id: merchantId(),
    username: makeUsername(username || `p${billNumber}`),
    amount: Math.round(Number(amount) * 100) / 100,
  };

  try {
    const r = await fetch(CREATE_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: `HTTP ${r.status} (non-JSON): ${text.slice(0, 200)}` };
    }

    if (data.ok && data.payment_id) {
      return {
        success: true,
        qr_image: data.card_image || data.qr_image || "",
        qr_string: data.qr_string || data.qr_data || "",
        transaction_id: String(data.payment_id),
        pay_url: data.pay_url || "",
        expires_at: data.expires_at || "",
        raw: { ...data, card_image: undefined, qr_image: undefined },
      };
    }
    return {
      success: false,
      error: data.message || data.error || "Failed to create QR",
      raw: data,
    };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

/** POST /aba-api/check-payment { api_key, merchant_id, payment_id } → { ok, status: "PAID" | ... } */
export async function checkPayment(paymentId) {
  if (!isPaymentReady()) {
    return { paid: false, error: "Keys not set", simulation: true };
  }

  const payload = {
    api_key: apiKey(),
    merchant_id: merchantId(),
    payment_id: String(paymentId),
  };

  try {
    const r = await fetch(CHECK_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    const status = String(data.status || "").toUpperCase();
    const paid = !!data.ok && status === "PAID";
    return { paid, status: status.toLowerCase(), amount: data.amount, raw: data };
  } catch (e) {
    return { paid: false, error: e.message || String(e) };
  }
}
