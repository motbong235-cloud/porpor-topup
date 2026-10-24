import crypto from "crypto";

function botToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
}
function channelId() {
  return (process.env.TELEGRAM_CHANNEL_ID || process.env.TG_CHANNEL_ID || "").trim();
}
export function botUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || process.env.TG_BOT_USERNAME || "").trim().replace(/^@/, "");
}
export function isNotifyReady() {
  return Boolean(botToken() && channelId());
}
export function isLoginReady() {
  return Boolean(botToken() && botUsername());
}

export async function sendTelegram(chatId, text, extra = {}) {
  const token = botToken();
  if (!token || !chatId) return { ok: false, error: "not_configured" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...extra,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: !!data.ok, raw: data };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

export async function notifyChannel(text) {
  if (!isNotifyReady()) return { ok: false, error: "not_configured" };
  return sendTelegram(channelId(), text);
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatOrderMsg(kind, o) {
  const title =
    kind === "paid" ? "✅ បង់ប្រាក់រួច" :
    kind === "new" ? "🛒 Order ថ្មី" :
    kind === "delivered" ? "📦 ដឹករួច" : "ℹ️ Order";
  const lines = [
    `<b>${title}</b>`,
    `ID: <code>${esc(o.id)}</code>`,
    `Status: <b>${esc(o.status)}</b>`,
    `Game: ${esc(o.gameName)}`,
    `Pack: ${esc(o.packName)} ×${esc(o.qty || 1)}`,
    `Total: <b>$${Number(o.total || 0).toFixed(2)}</b>`,
  ];
  if (o.userId && o.userId !== "gift") {
    lines.push(`Player: <code>${esc(o.userId)}</code>${o.zoneId ? ` / ${esc(o.zoneId)}` : ""}`);
  }
  if (o.telegramId) lines.push(`TG: <code>${esc(o.telegramId)}</code>`);
  if (o.note) lines.push(`Note: ${esc(String(o.note).slice(0, 200))}`);
  if (o.clientIp) lines.push(`IP: ${esc(o.clientIp)}`);
  return lines.join("\n");
}

export function verifyTelegramLogin(payload) {
  const token = botToken();
  if (!token) return { ok: false, error: "not_configured" };
  const data = { ...payload };
  const hash = String(data.hash || "");
  delete data.hash;
  // Telegram sends numeric fields as numbers sometimes — stringify all
  const check = Object.keys(data)
    .filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== "")
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const hmac = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (hmac !== hash) return { ok: false, error: "bad_hash" };
  const authDate = Number(data.auth_date) || 0;
  if (authDate && Date.now() / 1000 - authDate > 86400) return { ok: false, error: "expired" };
  return {
    ok: true,
    user: {
      id: Number(data.id),
      first_name: String(data.first_name || ""),
      last_name: String(data.last_name || ""),
      username: String(data.username || ""),
      photo_url: String(data.photo_url || ""),
    },
  };
}

/** Signed session cookie so login survives Render restarts */
function sessionSecret() {
  return botToken() || process.env.ADMIN_PASSWORD || "porpor-tg-secret";
}

export function signTgSession(user) {
  const body = Buffer.from(JSON.stringify({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    photo_url: user.photo_url,
    exp: Date.now() + 30 * 24 * 3600 * 1000,
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readTgSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expect = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data?.id || (data.exp && data.exp < Date.now())) return null;
    return {
      id: data.id,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      username: data.username || "",
      photo_url: data.photo_url || "",
    };
  } catch {
    return null;
  }
}
