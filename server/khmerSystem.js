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
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_key: apiKey(),
        merchant_id: merchantId(),
        amount: "0.01",
        bill_number: `TEST-${Date.now().toString(36)}`,
        description: "Porpor connection test",
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
      for (const k of ["qr_image", "qr"]) if (body[k]) body[k] = `[${String(body[k]).length} chars]`;
    }
    return { ...info, httpStatus: r.status, response: body };
  } catch (e) {
    return { ...info, result: `network error: ${e.message}` };
  }
}

export function isPaymentReady() {
  return Boolean(apiKey() && merchantId());
}

export async function createQr(amount, billNumber, description = "Porpor TOPUP") {
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
    amount: Number(amount).toFixed(2),
    bill_number: String(billNumber),
    description,
  };

  try {
    const r = await fetch(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json();

    if (data.status === "success" || data.qr_image || data.qr) {
      return {
        success: true,
        qr_image: data.qr_image || data.qr,
        qr_string: data.qr_string || data.qr_data || "",
        transaction_id: data.transaction_id || data.tran_id || billNumber,
        raw: data,
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

export async function checkPayment(transactionId) {
  if (!isPaymentReady()) {
    return { paid: false, error: "Keys not set", simulation: true };
  }

  const payload = {
    api_key: apiKey(),
    merchant_id: merchantId(),
    transaction_id: String(transactionId),
  };

  try {
    const r = await fetch(CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    const status = String(data.status || "").toLowerCase();
    const paid = ["success", "paid", "completed", "successful"].includes(status);
    return { paid, status, amount: data.amount, raw: data };
  } catch (e) {
    return { paid: false, error: e.message || String(e) };
  }
}
