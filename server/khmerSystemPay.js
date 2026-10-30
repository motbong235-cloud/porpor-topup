/**
 * Khmer System — ABA PayWay client (shared for Node websites + APIs)
 *
 * Env:
 *   ABA_API_KEY, ABA_MERCHANT_ID
 *   KHMER_SYSTEM_URL (default https://khmer-system.com)
 *   PUBLIC_BASE_URL  (https://yoursite.com — for /open-aba links)
 *   QR_EXPIRE_SEC    (default 3600)
 *
 * Same contract as python/khmer_system_pay.py and Kai- bot.
 */

const BASE_URL = (process.env.KHMER_SYSTEM_URL || "https://khmer-system.com").replace(/\/$/, "");
const CREATE_URL = process.env.ABA_CREATE_URL || `${BASE_URL}/aba-api/generate-qr`;
const CHECK_URL = process.env.ABA_CHECK_URL || `${BASE_URL}/aba-api/check-payment`;

function clean(v) {
  return String(v || "")
    .replace(/[\s\u200b\ufeff]+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "");
}
export function apiKey() {
  return clean(process.env.ABA_API_KEY);
}
export function merchantId() {
  return clean(process.env.ABA_MERCHANT_ID);
}
export function isPaymentReady() {
  return Boolean(apiKey() && merchantId());
}
export function publicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
}

function makeUsername(raw) {
  const u = String(raw || "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 32);
  return u || "customer";
}

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/** Build abamobilebank:// deeplink from KHQR string */
export function buildAbaDeeplink(qrString) {
  const q = String(qrString || "").trim();
  if (!q) return "";
  if (q.toLowerCase().startsWith("abamobilebank://")) {
    const low = q.toLowerCase();
    if (!low.includes("type=payway") && low.includes("qrcode=")) {
      const hostQ = q.split("://").slice(1).join("://");
      if (hostQ.includes("?")) {
        const [host, qs] = hostQ.split("?");
        return `abamobilebank://${host}?type=payway&${qs}`;
      }
    }
    return q;
  }
  return `abamobilebank://ababank.com?type=payway&qrcode=${encodeURIComponent(q)}`;
}

/**
 * HTTPS link for Telegram buttons / web — hits YOUR /open-aba?d=TOKEN
 * which redirects into ABA Mobile (custom scheme not allowed as Telegram button URL).
 */
export function openAbaHttpsLink(deeplinkOrQr, base) {
  const root = (base || publicBaseUrl()).replace(/\/$/, "");
  if (!root) return "";
  let raw = String(deeplinkOrQr || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || /^tg:\/\//i.test(raw)) return raw;
  const dl = raw.toLowerCase().startsWith("abamobilebank://") ? raw : buildAbaDeeplink(raw);
  const tok = Buffer.from(dl, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${root}/open-aba?d=${tok}`;
}

/**
 * Create KHQR via Khmer System
 * @returns { success, payment_id/transaction_id, qr_image, qr_string, pay_url, deeplink, open_aba_url, expires_at, error }
 */
export async function createQr(amount, billNumber, username) {
  if (!isPaymentReady()) {
    return { success: false, ok: false, error: "ABA_API_KEY or ABA_MERCHANT_ID not set", simulation: true };
  }
  const QR_EXPIRE_SEC = Math.max(300, Number(process.env.QR_EXPIRE_SEC || 3600) || 3600);
  const payload = {
    api_key: apiKey(),
    merchant_id: merchantId(),
    username: makeUsername(username || `p${billNumber}`),
    amount: Math.round(Number(amount) * 100) / 100,
    expires_in: QR_EXPIRE_SEC,
    expire_in: QR_EXPIRE_SEC,
    ttl: QR_EXPIRE_SEC,
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
      return { success: false, ok: false, error: `HTTP ${r.status} (non-JSON): ${text.slice(0, 200)}` };
    }

    if (data.ok && data.payment_id) {
      const qr_string = data.qr_string || data.qr_data || data.qr || "";
      let deeplink =
        data.abapay_deeplink || data.aba_deeplink || data.deeplink || data.deep_link || "";
      if (!deeplink && qr_string) deeplink = buildAbaDeeplink(qr_string);
      const open_aba_url = openAbaHttpsLink(deeplink || qr_string);

      const minMs = Date.now() + QR_EXPIRE_SEC * 1000;
      const rawExp = data.expires_at || data.expire_at || data.expired_at;
      const ms = rawExp ? Date.parse(rawExp) : NaN;
      const expires_at =
        Number.isFinite(ms) && ms >= minMs ? new Date(ms).toISOString() : new Date(minMs).toISOString();

      return {
        success: true,
        ok: true,
        qr_image: data.card_image || data.qr_image || "",
        qr_string,
        transaction_id: String(data.payment_id),
        payment_id: String(data.payment_id),
        pay_url: data.pay_url || data.checkout_url || "",
        deeplink,
        open_aba_url,
        expires_at,
        raw: { ...data, card_image: undefined, qr_image: undefined },
      };
    }
    return {
      success: false,
      ok: false,
      error: data.message || data.error || "Failed to create QR",
      raw: data,
    };
  } catch (e) {
    return { success: false, ok: false, error: e.message || String(e) };
  }
}

export async function checkPayment(paymentId) {
  if (!isPaymentReady()) {
    return { paid: false, error: "Keys not set", simulation: true };
  }
  try {
    const r = await fetch(CHECK_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        api_key: apiKey(),
        merchant_id: merchantId(),
        payment_id: String(paymentId),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    const status = String(data.status || data.payment_status || data.state || "").toUpperCase();
    const paidFlag = data.ok === true || data.paid === true || data.success === true;
    const paidStatuses = new Set(["PAID", "SUCCESS", "COMPLETED", "COMPLETE", "DONE", "SETTLED"]);
    const paid = paidFlag || paidStatuses.has(status);
    const code = data.status_code ?? data.code;
    const paidByCode = code === 1 || code === "1" || code === 200;
    return { paid: !!(paid || paidByCode), status: status.toLowerCase() || (paid ? "paid" : "unknown"), amount: data.amount ?? data.total ?? data.paid_amount, raw: data };
  } catch (e) {
    return { paid: false, error: e.message || String(e) };
  }
}

/** Express/Connect middleware-style handler for GET /open-aba?d=TOKEN */
export function openAbaHtml(deeplink) {
  let dl = String(deeplink || "").trim();
  if (!dl.toLowerCase().startsWith("abamobilebank://")) dl = buildAbaDeeplink(dl);
  const low = dl.toLowerCase();
  if (!low.includes("type=payway") && low.includes("qrcode=")) {
    const hostQ = dl.split("://").slice(1).join("://");
    if (hostQ.includes("?")) {
      const [host, qs] = hostQ.split("?");
      dl = `abamobilebank://${host}?type=payway&${qs}`;
    }
  }
  const pathQ = dl.split("://").slice(1).join("://");
  const intent = `intent://${pathQ}#Intent;scheme=abamobilebank;package=com.paygo24.ibank;S.browser_fallback_url=${encodeURIComponent(dl)};end`;
  const jsDl = JSON.stringify(dl);
  const jsIntent = JSON.stringify(intent);
  return `<!DOCTYPE html>
<html lang="km"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>OPEN ABA Mobile</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#e8eefc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:1.5rem}
.card{background:#121a2f;border-radius:16px;padding:1.5rem;max-width:360px;border:1px solid #24304d}
a.btn{display:inline-block;margin-top:1rem;padding:.85rem 1.2rem;border-radius:12px;background:linear-gradient(135deg,#1d6adf,#22d3ee);color:#fff;font-weight:700;text-decoration:none}
</style></head><body>
<div class="card">
  <h1>ABA Mobile</h1>
  <p>កំពុងបើកកម្មវិធី ABA…</p>
  <p><a class="btn" href=${jsDl}>OPEN ABA Mobile</a></p>
  <p style="opacity:.6;font-size:.85rem">បើមិនបើកសូមចុចប៊ូតុង (Chrome/Safari មិនមែន in-app Telegram)</p>
</div>
<script>
(function(){
  var dl=${jsDl}, intent=${jsIntent};
  var isAndroid=/Android/i.test(navigator.userAgent||"");
  try{ location.href = isAndroid ? intent : dl; }catch(e){}
  setTimeout(function(){ try{ location.href=dl; }catch(e){} }, 800);
})();
</script>
</body></html>`;
}

/** Express route helper: app.get('/open-aba', openAbaRoute) */
export function openAbaRoute(req, res) {
  const tok = String(req.query.d || "").trim();
  let deeplink = "";
  if (tok) {
    try {
      const pad = "=".repeat((4 - (tok.length % 4)) % 4);
      const b64 = tok.replace(/-/g, "+").replace(/_/g, "/") + pad;
      deeplink = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      deeplink = "";
    }
  }
  if (!deeplink || !deeplink.toLowerCase().startsWith("abamobilebank://")) {
    res.status(400).type("html").send("<p>Invalid or expired ABA link</p>");
    return;
  }
  res.type("html").send(openAbaHtml(deeplink));
}

export async function diagnose() {
  const info = {
    apiKey: { set: !!apiKey(), length: apiKey().length },
    merchantId: { set: !!merchantId(), value: merchantId() },
    endpoint: CREATE_URL,
    publicBase: publicBaseUrl(),
  };
  if (!isPaymentReady()) return { ...info, result: "keys not set" };
  const r = await createQr(0.01, "diag", "diag_test");
  if (r.qr_image) r.qr_image = `[${String(r.qr_image).length} chars]`;
  return { ...info, result: r };
}
