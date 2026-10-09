/**
 * Khmer-System ABA PayWay (Node port of khmer_system.py)
 * Env: ABA_API_KEY, ABA_MERCHANT_ID
 */
const BASE_URL = process.env.KHMER_SYSTEM_URL || "https://khmer-system.com";
const CREATE_URL = `${BASE_URL}/aba-api/generate-qr`;
const CHECK_URL = `${BASE_URL}/aba-api/check-payment`;

function apiKey() {
  return (process.env.ABA_API_KEY || "").trim();
}
function merchantId() {
  return (process.env.ABA_MERCHANT_ID || "").trim();
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
