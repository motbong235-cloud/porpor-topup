/**
 * In-site Live Chat — 1 IP = 1 user. Supports text / image / voice.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "livechat.json");

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ threads: {} }, null, 2));
  }
}

function read() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { threads: {} };
  }
}

function write(db) {
  ensure();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

function rid() {
  return crypto.randomBytes(8).toString("hex");
}

export function ipKey(ip) {
  let s = String(ip || "unknown").trim().toLowerCase();
  if (s.startsWith("::ffff:")) s = s.slice(7);
  s = s.replace(/[^a-z0-9.:]/g, "_").slice(0, 64);
  return s || "unknown";
}

const WELCOME =
  "សួស្តី! 👋 សូមស្វាគមន៍មកកាន់ POR POR TOPUP Live Chat។\nHi! How can we help you today?";

export function getOrCreateThread(ip, meta = {}) {
  const db = read();
  const tid = ipKey(ip);
  if (!db.threads[tid]) {
    db.threads[tid] = {
      id: tid,
      ip: tid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: meta.name || "",
      orderId: meta.orderId || "",
      messages: [
        { id: rid(), role: "agent", type: "text", text: WELCOME, at: Date.now() },
      ],
      unreadAdmin: 0,
      unreadUser: 1,
    };
    write(db);
  } else {
    let changed = false;
    if (meta.name && !db.threads[tid].name) {
      db.threads[tid].name = String(meta.name).slice(0, 80);
      changed = true;
    }
    if (meta.orderId) {
      db.threads[tid].orderId = String(meta.orderId).slice(0, 40);
      changed = true;
    }
    if (changed) write(db);
  }
  return db.threads[tid];
}

export function listThreads() {
  const db = read();
  return Object.values(db.threads)
    .map((t) => {
      const last = (t.messages || []).slice(-1)[0] || null;
      let preview = last?.text || "";
      if (last?.type === "image") preview = "📷 Photo";
      if (last?.type === "voice") preview = "🎤 Voice";
      return {
        id: t.id,
        ip: t.ip || t.id,
        name: t.name,
        orderId: t.orderId,
        updatedAt: t.updatedAt,
        unreadAdmin: t.unreadAdmin || 0,
        last: last ? { ...last, text: preview } : null,
        count: (t.messages || []).length,
      };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getMessages(threadId, after = 0) {
  const db = read();
  const tid = ipKey(threadId);
  const t = db.threads[tid] || db.threads[threadId];
  if (!t) return null;
  const msgs = (t.messages || []).filter((m) => (m.at || 0) > after);
  return {
    thread: { id: t.id, ip: t.ip || t.id, name: t.name, orderId: t.orderId },
    messages: msgs,
  };
}

function pushMessage(tid, msg, meta, asAdmin) {
  const db = read();
  if (!db.threads[tid]) getOrCreateThread(tid, meta || {});
  const all = read();
  const t = all.threads[tid];
  t.messages = t.messages || [];
  t.messages.push(msg);
  t.updatedAt = msg.at;
  if (asAdmin) {
    t.unreadUser = (t.unreadUser || 0) + 1;
    t.unreadAdmin = 0;
  } else {
    t.unreadAdmin = (t.unreadAdmin || 0) + 1;
    if (meta?.name) t.name = String(meta.name).slice(0, 80);
    if (meta?.orderId) t.orderId = String(meta.orderId).slice(0, 40);
  }
  if (t.messages.length > 300) t.messages = t.messages.slice(-300);
  all.threads[tid] = t;
  write(all);
  return msg;
}

export function postUserMessage(threadId, payload, meta = {}) {
  const tid = ipKey(threadId);
  const type = payload.type || "text";
  const msg = {
    id: rid(),
    role: "user",
    type,
    text: type === "text" ? String(payload.text || "").slice(0, 2000) : payload.text || "",
    mediaUrl: payload.mediaUrl || "",
    duration: payload.duration || 0,
    at: Date.now(),
  };
  if (type === "text" && !msg.text) return null;
  if ((type === "image" || type === "voice") && !msg.mediaUrl) return null;
  return pushMessage(tid, msg, meta, false);
}

export function postAgentMessage(threadId, payload) {
  const tid = ipKey(threadId);
  const db = read();
  const t = db.threads[tid] || db.threads[threadId];
  if (!t) return null;
  const type = payload.type || "text";
  const msg = {
    id: rid(),
    role: "agent",
    type,
    text: type === "text" ? String(payload.text || "").slice(0, 2000) : payload.text || "",
    mediaUrl: payload.mediaUrl || "",
    duration: payload.duration || 0,
    at: Date.now(),
  };
  if (type === "text" && !msg.text) return null;
  if ((type === "image" || type === "voice") && !msg.mediaUrl) return null;
  return pushMessage(t.id, msg, null, true);
}

export function markRead(threadId, who) {
  const tid = ipKey(threadId);
  const db = read();
  const t = db.threads[tid] || db.threads[threadId];
  if (!t) return;
  if (who === "admin") t.unreadAdmin = 0;
  if (who === "user") t.unreadUser = 0;
  db.threads[t.id] = t;
  write(db);
}
