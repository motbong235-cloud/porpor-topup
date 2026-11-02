import crypto from "crypto";
import { getSettings } from "./store.js";

const DEFAULT_BOT_TOKEN = "8838911697:AAEClpZ_km1-dV2w9cxUnQJn99ey2Pay10o";
const DEFAULT_CHANNEL_ID = "-1004493908885";
const DEFAULT_BOT_USER = "porporwebbot";

export function botToken() {
  const env = (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
  if (env) return env;
  try {
    const s = String(getSettings().tgBotToken || "").trim();
    if (s) return s;
  } catch {}
  return DEFAULT_BOT_TOKEN;
}
function channelId() {
  const env = (process.env.TELEGRAM_CHANNEL_ID || process.env.TG_CHANNEL_ID || "").trim();
  if (env) return env;
  try {
    const s = String(getSettings().tgChannelId || "").trim();
    if (s) return s;
  } catch {}
  return DEFAULT_CHANNEL_ID;
}
export function botUsername() {
  const env = (process.env.TELEGRAM_BOT_USERNAME || process.env.TG_BOT_USERNAME || "").trim().replace(/^@/, "");
  if (env) return env;
  try {
    const s = String(getSettings().tgBotUsername || "").trim().replace(/^@/, "");
    if (s) return s;
  } catch {}
  return "porporwebbot";
}

/** Route specific products (e.g. TikTok Khmer) to Kai- bot instead of Porpor channel. */
function kaiBotToken() {
  const env = (process.env.KAI_BOT_TOKEN || process.env.KAI_ORDER_BOT_TOKEN || "").trim();
  if (env) return env;
  try {
    const s = String(getSettings().kaiBotToken || "").trim();
    if (s) return s;
  } catch {}
  return "";
}
function kaiChatId() {
  const env = (process.env.KAI_CHAT_ID || process.env.KAI_ORDER_CHAT_ID || "").trim();
  if (env) return env;
  try {
    const s = String(getSettings().kaiChatId || "").trim();
    if (s) return s;
  } catch {}
  return "";
}
/** Comma/space separated game ids, or keywords matched against gameId/gameName */
function kaiRouteRules() {
  try {
    const raw = String(getSettings().kaiRouteGames || "tiktok-khmer,tiktok_khmer,tiktok khmer").trim();
    return raw.split(/[,\n]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  } catch {
    return ["tiktok-khmer", "tiktok_khmer", "tiktok khmer"];
  }
}
export function isKaiRouteOrder(o) {
  const rules = kaiRouteRules();
  if (!rules.length) return false;
  const gid = String(o?.gameId || "").toLowerCase();
  const gname = String(o?.gameName || "").toLowerCase();
  const pack = String(o?.packName || "").toLowerCase();
  const blob = `${gid} ${gname} ${pack}`;
  return rules.some((r) => r && (gid === r || gid.includes(r) || gname.includes(r) || blob.includes(r)));
}
function kaiChannelId() {
  const env = (process.env.KAI_CHANNEL_ID || "").trim();
  if (env) return env;
  try {
    const s = String(getSettings().kaiChannelId || "").trim();
    if (s) return s;
  } catch {}
  return "";
}
export function isKaiNotifyReady() {
  return Boolean(kaiBotToken() && (kaiChatId() || kaiChannelId()));
}

export function isNotifyReady() {
  return Boolean(botToken() && channelId());
}
export function isLoginReady() {
  return Boolean(botToken() && botUsername());
}


export async function sendTelegramWithToken(token, chatId, text, extra = {}) {
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
  if (!isNotifyReady()) {
    console.warn("[telegram] notify skipped — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID (or Admin → Settings)");
    return { ok: false, error: "not_configured" };
  }
  const r = await sendTelegram(channelId(), text);
  if (!r.ok) console.warn("[telegram] notify failed", r.error || r.raw);
  return r;
}


/** Send a document (file buffer) to a chat. */
export async function sendDocument(chatId, buffer, filename, caption = "") {
  const token = botToken();
  if (!token || !chatId) return { ok: false, error: "not_configured" };
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", String(caption).slice(0, 1000));
    form.append(
      "document",
      new Blob([buffer], { type: "application/json" }),
      filename || "backup.json"
    );
    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: !!data.ok, raw: data, error: data.description };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Send backup JSON to a PRIVATE chat only — never the public channel.
 * Set TELEGRAM_BACKUP_CHAT_ID = your personal Telegram user id (or private group).
 * User must have pressed /start on the bot at least once.
 */
function backupChatId() {
  return (
    process.env.TELEGRAM_BACKUP_CHAT_ID ||
    process.env.TG_BACKUP_CHAT_ID ||
    ""
  ).trim();
}

export async function sendBackupToTelegram(payload, filename) {
  const chat = backupChatId();
  if (!chat) {
    return { ok: false, error: "no_backup_chat", skipped: true };
  }
  if (!botToken()) return { ok: false, error: "not_configured" };

  const name =
    filename ||
    `porpor-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);
  const buf = Buffer.from(json, "utf8");
  if (buf.length > 20 * 1024 * 1024) {
    return { ok: false, error: "backup_too_large" };
  }
  const orders =
    payload?.db?.orders?.length ??
    payload?.orders?.length ??
    0;
  const plain =
    "Porpor Backup (private)\n" +
    new Date().toISOString().slice(0, 19) +
    "Z\nsize " +
    (buf.length / 1024).toFixed(1) +
    " KB · orders ~" +
    orders;
  const r = await sendDocument(chat, buf, name, plain);
  if (!r.ok) console.warn("[telegram] private backup send failed", r.error || r.raw);
  else console.log("[telegram] private backup sent →", chat, name, buf.length);
  return r;
}


function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isRobuxSendOrder(o) {
  const dt = String(o?.deliveryType || "");
  if (dt === "robux_send") return true;
  if (dt === "live_chat") {
    const g = `${o?.gameName || ""} ${o?.gameId || ""}`.toLowerCase();
    return /robux|roblox/.test(g);
  }
  return false;
}

/** Bot alert when Robux must be sent manually (no silent auto transfer). */
export function formatRobuxSendMsg(o) {
  const lines = [
    "<b>🔔 ROBUX SEND — ត្រូវផ្ញើ</b>",
    "",
    "Order: <code>" + esc(o.id) + "</code>",
    "Username: <code>" + esc(o.userId || "—") + "</code>",
    "Pack: <b>" + esc(o.packName) + "</b> ×" + esc(o.qty || 1),
    "Amount: <b>$" + Number(o.total || 0).toFixed(2) + "</b>",
    "Game: " + esc(o.gameName || "Robux Send"),
    "Status: <b>" + esc(o.status || "queued") + "</b>",
    "",
    "⚠️ ប្រព័ន្ធមិន auto ផ្ញើ Robux បានទេ — សូមផ្ញើពី account ហាង រួច mark Done ក្នុង Admin",
  ];
  if (o.telegramId) lines.push("Customer TG: <code>" + esc(o.telegramId) + "</code>");
  if (o.clientIp) lines.push("IP: " + esc(o.clientIp));
  return lines.join("\n");
}


function maskUid(uid) {
  const s = String(uid || "");
  if (s.length <= 2) return s + "xxxxxxxx";
  return s.slice(0, 2) + "x".repeat(Math.max(8, s.length - 2));
}
function khNow() {
  try {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Phnom_Penh" }).replace("T", " ");
  } catch {
    return new Date().toISOString();
  }
}

/** Same style as Kai- channel / order bot message */
export function formatKaiOrderMsg(o, { forChannel = false } = {}) {
  const buyer = o.telegramId || o.clientIp || o.userId || "—";
  const label = o.packName || o.gameName || "TikTok Khmer";
  const qty = o.qty || 1;
  const price = Number(o.total || 0);
  const status =
    o.status === "queued" || o.status === "paid" || o.status === "processing"
      ? "កំពុងដំណើរការ ⏳"
      : o.status === "delivered" || o.status === "done"
        ? "ជោគជ័យ ✅"
        : String(o.status || "កំពុងដំណើរការ ⏳");
  const svc = qty > 1 ? `${label} x${qty} - $${price.toFixed(2)}` : `${label} - $${price.toFixed(2)}`;
  // Channel: hide full link. Order bot: show real TikTok link / username
  const rawLink = String(o.userId || o.link || "").trim();
  const linkDisp = forChannel
    ? "Private"
    : (rawLink && rawLink !== "gift" ? rawLink : "—");
  const lines = [
    "📦 <b>ការបញ្ជាទិញថ្មី!</b>",
    "",
    `Buyer ID: <code>${esc(forChannel ? maskUid(buyer) : String(buyer))}</code>`,
    "",
    `🔗 Link: ${forChannel ? linkDisp : `<code>${esc(linkDisp)}</code>`}`,
    `🎯 សេវាកម្ម: ${esc(svc)}`,
    `📋 Order ID: <code>${esc(o.id)}</code>`,
    `💵 តម្លៃសរុប: <b>$${price.toFixed(2)}</b>`,
    `📦 ការបញ្ជា: ${status}`,
    `📅 Date: ${khNow()}`,
    "",
    "អរគុណចំពោះការប្រើប្រាស់ ❤️",
  ];
  if (!forChannel) {
    lines.push("");
    lines.push("<i>ពី Porpor Topup · TikTok Khmer</i>");
    if (o.clientIp) lines.push(`IP: <code>${esc(o.clientIp)}</code>`);
  }
  return lines.join("\n");
}

/**
 * TikTok Khmer → Kai Order Bot (full link) + Kai Channel (Private link)
 * Other products → Porpor channel
 */
export async function notifyOrder(kind, o) {
  if (isKaiRouteOrder(o)) {
    if (!isKaiNotifyReady()) {
      console.warn("[telegram] Kai route order but kai settings incomplete — fallback Porpor");
      return notifyChannel(formatOrderMsg(kind, o));
    }
    const token = kaiBotToken();
    const results = [];
    // 1) Order bot / admin chat — full link
    const orderChat = kaiChatId();
    if (orderChat) {
      const textBot = formatKaiOrderMsg(o, { forChannel: false });
      const r1 = await sendTelegramWithToken(token, orderChat, textBot);
      results.push(r1);
      if (!r1.ok) console.warn("[telegram] Kai order-bot failed", r1.error || r1.raw);
      else console.log("[telegram] Kai order-bot →", orderChat, o.id);
    }
    // 2) Kai channel — same style, link Private
    const ch = kaiChannelId();
    if (ch) {
      const textCh = formatKaiOrderMsg(o, { forChannel: true });
      const r2 = await sendTelegramWithToken(token, ch, textCh);
      results.push(r2);
      if (!r2.ok) console.warn("[telegram] Kai channel failed", r2.error || r2.raw);
      else console.log("[telegram] Kai channel →", ch, o.id);
    }
    return results.find((r) => r.ok) || results[0] || { ok: false, error: "no_target" };
  }
  return notifyChannel(formatOrderMsg(kind, o));
}

export function formatOrderMsg(kind, o) {
  if (kind === "paid" && isRobuxSendOrder(o)) return formatRobuxSendMsg(o);
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
