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
function normalizeChatId(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  // allow "@channel" or numeric / -100...
  if (s.startsWith("@")) return s;
  s = s.replace(/\s+/g, "");
  return s;
}
function kaiBotToken() {
  const env = (process.env.KAI_BOT_TOKEN || process.env.KAI_ORDER_BOT_TOKEN || process.env.ORDER_BOT_TOKEN || "").trim();
  if (env) return env;
  try {
    const st = getSettings();
    const s = String(st.kaiOrderBotToken || st.kaiBotToken || "").trim();
    if (s) return s;
  } catch {}
  return "";
}
/** Token used only for Order Bot chat (optional separate from channel bot). */
function kaiOrderBotToken() {
  const env = (process.env.KAI_ORDER_BOT_TOKEN || process.env.ORDER_BOT_TOKEN || "").trim();
  if (env) return env;
  try {
    const st = getSettings();
    const s = String(st.kaiOrderBotToken || "").trim();
    if (s) return s;
  } catch {}
  // fall back to main kai token
  return kaiBotToken();
}
function kaiChatId() {
  const env = (
    process.env.KAI_CHAT_ID ||
    process.env.KAI_ORDER_CHAT_ID ||
    process.env.ORDER_BOT_CHAT_ID ||
    ""
  ).trim();
  if (env) return normalizeChatId(env);
  try {
    const st = getSettings();
    const s = String(st.kaiChatId || st.kaiOrderChatId || st.orderBotChatId || "").trim();
    if (s) return normalizeChatId(s);
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
export function isKaiRouteGame(game) {
  if (!game) return false;
  return isKaiRouteOrder({
    gameId: game.id || game.gameId,
    gameName: game.name || game.nameKm || game.gameName,
    packName: "",
  });
}
export function isKaiRouteOrder(o) {
  const rules = kaiRouteRules();
  if (!rules.length) return false;
  const gid = String(o?.gameId || "").toLowerCase();
  const gname = String(o?.gameName || "").toLowerCase();
  const pack = String(o?.packName || "").toLowerCase();
  const dt = String(o?.deliveryType || "").toLowerCase();
  const blob = `${gid} ${gname} ${pack} ${dt}`;
  // hard match common TikTok Khmer ids/names even if admin settings missing
  if (
    gid === "tiktok-khmer" ||
    gid === "tiktok_khmer" ||
    gname.includes("tiktok khmer") ||
    gname.includes("tiktok-khmer") ||
    /tiktok/.test(gid) && /khmer/.test(blob)
  ) {
    return true;
  }
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
  // TikTok Khmer → order bot private chat ONLY (never Porpor / Kai channel)
  return Boolean(kaiOrderBotToken() && kaiChatId());
}

export function isNotifyReady() {
  return Boolean(botToken() && channelId());
}
export function isLoginReady() {
  return Boolean(botToken() && botUsername());
}


export async function sendTelegramWithToken(token, chatId, text, extra = {}, retries = 1) {
  if (!token || !chatId) return { ok: false, error: "not_configured" };
  let last = { ok: false, error: "unknown" };
  for (let attempt = 0; attempt <= retries; attempt++) {
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
      last = { ok: !!data.ok, raw: data, error: data.description };
      if (last.ok) return last;
      // retry on flood / timeout style
      if (attempt < retries) await new Promise((x) => setTimeout(x, 800));
    } catch (e) {
      last = { ok: false, error: e.message || String(e) };
      if (attempt < retries) await new Promise((x) => setTimeout(x, 800));
    }
  }
  return last;
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

/** Bot alert when Robux order is paid — include Roblox profile so admin does not mis-send. */
export function formatRobuxSendMsg(o) {
  const st = String(o.status || "").toLowerCase();
  const statusLabel =
    st === "paid" || st === "queued" || st === "processing"
      ? "complete"
      : st === "delivered" || st === "done"
        ? "complete"
        : (o.status || "complete");
  const uname = o.rbxUsername || o.userId || "—";
  const lines = [
    "<b>🔔 ROBUX SEND — ត្រូវផ្ញើ</b>",
    "",
    "Order: <code>" + esc(o.id) + "</code>",
    "Username: <code>" + esc(uname) + "</code>",
  ];
  if (o.rbxDisplayName) lines.push("Display: <b>" + esc(o.rbxDisplayName) + "</b>");
  if (o.rbxUserId) lines.push("Roblox ID: <code>" + esc(o.rbxUserId) + "</code>");
  if (o.rbxProfileUrl) lines.push('Profile: <a href="' + esc(o.rbxProfileUrl) + '">' + esc(o.rbxProfileUrl) + "</a>");
  lines.push(
    "Pack: <b>" + esc(o.packName) + "</b> ×" + esc(o.qty || 1),
    "Amount: <b>$" + Number(o.total || 0).toFixed(2) + "</b>",
    "Game: " + esc(o.gameName || "Robux Send"),
    "Status: <b>" + esc(statusLabel) + "</b>",
  );
  if (o.telegramId) lines.push("Customer TG: <code>" + esc(o.telegramId) + "</code>");
  return lines.join("\n");
}

/** Send photo+caption to channel (Roblox avatar). Falls back to text. */
export async function sendTelegramPhoto(chatId, photoUrl, caption) {
  const token = botToken();
  if (!token || !chatId || !photoUrl) return { ok: false, error: "not_configured" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: String(photoUrl),
        caption: String(caption || "").slice(0, 1024),
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: !!data.ok, raw: data, error: data.description };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Robux paid notify → Porpor channel with profile photo when possible */
export async function notifyRobuxSend(o) {
  const text = formatRobuxSendMsg(o);
  const chat = (() => {
    try {
      const env = (process.env.TELEGRAM_CHANNEL_ID || process.env.TG_CHANNEL_ID || "").trim();
      if (env) return env;
      return String(getSettings().tgChannelId || "").trim() || channelId();
    } catch {
      return channelId();
    }
  })();
  if (!isNotifyReady()) return { ok: false, error: "not_configured" };
  if (o.rbxAvatarUrl) {
    const r = await sendTelegramPhoto(chat, o.rbxAvatarUrl, text);
    if (r.ok) return r;
    console.warn("[telegram] robux photo failed, fallback text", r.error || r.raw);
  }
  return notifyChannel(text);
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

function usernameFromLink(url) {
  const m = String(url || "").match(/tiktok\.com\/@([^/?#\s]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/^@/, "") : "";
}

export function formatKaiOrderMsg(o, { forChannel = false, kind = "paid" } = {}) {
  const buyer = o.telegramId || o.userId || "—";
  const label = o.packName || o.gameName || "TikTok Khmer";
  const qty = o.qty || 1;
  const price = Number(o.total || 0);
  const k = String(kind || o.status || "paid").toLowerCase();
  let title = "📦 <b>ការបញ្ជាទិញថ្មី!</b>";
  let status = "កំពុងដំណើរការ ⏳";
  if (k === "delivered" || k === "done" || k === "success" || o.status === "delivered" || o.status === "done") {
    title = "✅ <b>ការបញ្ជាទិញជោគជ័យ!</b>";
    status = "ជោគជ័យ ✅";
  } else if (k === "rejected" || k === "cancelled" || k === "canceled" || k === "failed" || o.status === "rejected" || o.status === "cancelled") {
    title = "❌ <b>ការបញ្ជាទិញត្រូវបានបដិសេធ</b>";
    status = "បដិសេធ ❌";
  } else {
    // paid / processing only (never unpaid "new")
    title = "📦 <b>ការបញ្ជាទិញថ្មី!</b>";
    status = "កំពុងដំណើរការ ⏳";
  }
  const svc = qty > 1 ? `${label} x${qty} - $${price.toFixed(2)}` : `${label} - $${price.toFixed(2)}`;
  // Prefer explicit video URL fields; never force "Private" — admin needs the link
  const rawLink = String(
    o.videoUrl || o.ttkVideoUrl || o.link || o.userId || ""
  ).trim();
  let linkDisp = "—";
  if (rawLink && rawLink !== "gift" && !/^PP-/i.test(rawLink) && rawLink.length > 3) {
    // if looks like username only, still show; if URL keep as-is
    linkDisp = rawLink;
  }
  const ttkUser = o.ttkUsername || usernameFromLink(rawLink) || usernameFromLink(o.link) || "";
  const ttkName = o.ttkDisplayName || "";
  const videoLine =
    linkDisp !== "—"
      ? (linkDisp.startsWith("http")
          ? `🔗 Video: ${esc(linkDisp)}`
          : `🔗 Video: <code>${esc(linkDisp)}</code>`)
      : "🔗 Video: <i>(no link)</i>";
  const lines = [
    title,
    "",
    `Buyer ID: <code>${esc(forChannel ? maskUid(buyer) : String(buyer))}</code>`,
    "",
    ttkUser
      ? `👤 TikTok: <b>@${esc(ttkUser)}</b>${ttkName && ttkName !== ttkUser ? ` · ${esc(ttkName)}` : ""}`
      : "👤 TikTok: <i>(parse username from link)</i>",
    ttkUser ? `🔗 Profile: https://www.tiktok.com/@${esc(ttkUser)}` : "",
    videoLine,
    `🎯 សេវាកម្ម: ${esc(svc)}`,
    `📋 Order ID: <code>${esc(o.id)}</code>`,
    `💵 តម្លៃសរុប: <b>$${price.toFixed(2)}</b>`,
    `📦 ការបញ្ជា: ${status}`,
    `📅 Date: ${khNow()}`,
    "",
    "🌐 <b>Source:</b> Porpor Topup (TikTok Khmer)",
    "អរគុណចំពោះការប្រើប្រាស់ ❤️",
  ].filter(Boolean);
  if (!forChannel) {
    lines.push("");
    lines.push("<i>ពី Porpor Topup · TikTok Khmer</i>");
    if (o.note && (k === "rejected" || o.status === "rejected")) {
      lines.push(`Note: ${esc(String(o.note).slice(0, 200))}`);
    }
  }
  return lines.join("\n");
}

/**
 * TikTok Khmer → ONLY Kai Order Bot + Kai Channel (never Porpor channel)
 * Notify only after payment (paid / delivered / rejected) — never on unpaid "new"
 * Other products → Porpor channel
 */
export async function notifyOrder(kind, o) {
  const k = String(kind || "").toLowerCase();

  // ——— TikTok Khmer → Order bot chat + Porpor channel (never Kai- channel)
  if (isKaiRouteOrder(o)) {
    if (k === "new" || k === "pending" || k === "created") {
      console.log("[telegram] TikTok skip unpaid", o?.id);
      return { ok: true, skipped: "await_payment" };
    }
    const results = [];
    // 1) Order bot (full link + username)
    if (isKaiNotifyReady()) {
      const textBot = formatKaiOrderMsg(o, { forChannel: false, kind: k });
      const r1 = await sendTelegramWithToken(kaiOrderBotToken(), kaiChatId(), textBot, {}, 2);
      results.push(r1);
      if (!r1.ok) console.warn("[telegram] TikTok ORDER chat FAILED", kaiChatId(), r1.error || r1.raw);
      else console.log("[telegram] TikTok ORDER chat OK →", kaiChatId(), o.id, k);
    } else {
      console.warn("[telegram] kaiOrderBotToken/kaiChatId missing — still send Porpor channel");
    }
    // 2) Porpor channel (username visible so admin does not mis-send)
    if (isNotifyReady()) {
      const textCh = formatKaiOrderMsg(o, { forChannel: true, kind: k });
      // Prefer photo thumbnail if we have it
      let r2;
      if (o.ttkThumbnail) {
        r2 = await sendTelegramPhoto(channelId(), o.ttkThumbnail, textCh);
        if (!r2.ok) r2 = await notifyChannel(textCh);
      } else {
        r2 = await notifyChannel(textCh);
      }
      results.push(r2);
      if (!r2.ok) console.warn("[telegram] TikTok Porpor channel FAILED", r2.error || r2.raw);
      else console.log("[telegram] TikTok Porpor channel OK", o.id, k);
    }
    return results.find((r) => r && r.ok) || results[0] || { ok: false, error: "tiktok_notify_failed" };
  }

  // ——— All other Porpor services → Porpor channel only
  if (!isNotifyReady()) {
    console.warn("[telegram] Porpor channel not configured");
    return { ok: false, error: "not_configured" };
  }
  // Robux uses richer template on paid
  if ((k === "paid" || k === "queued") && isRobuxSendOrder(o)) {
    const r = await notifyRobuxSend(o);
    if (!r.ok) {
      console.warn("[telegram] robux notify failed, retry text", r.error || r.raw);
      return notifyChannel(formatOrderMsg(k === "queued" ? "paid" : kind, o));
    }
    return r;
  }
  const text = formatOrderMsg(kind, o);
  let r = await notifyChannel(text);
  if (!r.ok) {
    console.warn("[telegram] Porpor channel send failed, retry once", r.error || r.raw);
    await new Promise((x) => setTimeout(x, 600));
    r = await notifyChannel(text);
  }
  if (r.ok) console.log("[telegram] Porpor channel OK", o?.id, k);
  else console.warn("[telegram] Porpor channel FAILED", o?.id, k, r.error || r.raw);
  return r;
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
  if (!sameSig(hmac, hash)) return { ok: false, error: "bad_hash" };
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
let fallbackSecret = null;
function sessionSecret() {
  const env = String(process.env.SESSION_SECRET || "").trim();
  if (env) return env;
  const bt = botToken();
  if (bt) return bt;
  // No secret configured: random per-process key (sessions reset on restart) — never a public default
  if (!fallbackSecret) fallbackSecret = crypto.randomBytes(32).toString("hex");
  return fallbackSecret;
}

function sameSig(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
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
  if (!sameSig(sig, expect)) return null;
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
