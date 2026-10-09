import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_SETTINGS = {
  siteName: "Porpor TOPUP",
  taglineKm: "ហាងហ្គេមព្រីមៀម",
  taglineEn: "PREMIUM GAME STORE",
  telegram: "https://t.me/porportopup",
  announcementKm: "",
  announcementEn: "",
  supportEmail: "support@porportopup.com",
  maintenance: false,
  coupons: [
    { code: "PORPOR10", type: "percent", value: 10, min: 0 },
    { code: "BLUE", type: "fixed", value: 0.5, min: 2 },
  ],
  /** When true and keys set, auto-order on Khmer TopUp after payment */
  autoTopup: true,
  /** Which Khmer TopUp games/packages to sell (Admin → Services) */
  ktSelection: { markupPercent: 0, games: {} },
};

const LEGACY_KEYS = ["defaultWallet", "closedGames", "packageMap", "allowDemoPay"];

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      settings: { ...DEFAULT_SETTINGS },
      orders: [],
      sessions: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function write(db) {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getSettings() {
  const db = read();
  const merged = { ...DEFAULT_SETTINGS, ...db.settings };
  for (const k of LEGACY_KEYS) delete merged[k];
  return merged;
}

export function updateSettings(patch) {
  const db = read();
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings, ...patch };
  for (const k of LEGACY_KEYS) delete db.settings[k];
  write(db);
  return db.settings;
}

export function listOrders() {
  return read().orders || [];
}

export function getOrder(id) {
  return listOrders().find((o) => o.id === id) || null;
}

export function createOrder(order) {
  const db = read();
  db.orders = [order, ...(db.orders || [])].slice(0, 500);
  write(db);
  return order;
}

export function updateOrder(id, patch) {
  const db = read();
  const i = (db.orders || []).findIndex((o) => o.id === id);
  if (i < 0) return null;
  db.orders[i] = { ...db.orders[i], ...patch, updatedAt: Date.now() };
  write(db);
  return db.orders[i];
}

export function deleteOrder(id) {
  const db = read();
  const before = (db.orders || []).length;
  db.orders = (db.orders || []).filter((o) => o.id !== id);
  write(db);
  return before !== db.orders.length;
}

export function createSession() {
  const db = read();
  const token = crypto.randomBytes(24).toString("hex");
  const expires = Date.now() + 1000 * 60 * 60 * 12;
  db.sessions = db.sessions || {};
  db.sessions[token] = { expires };
  // prune old
  for (const [k, v] of Object.entries(db.sessions)) {
    if (v.expires < Date.now()) delete db.sessions[k];
  }
  write(db);
  return { token, expires };
}

export function validSession(token) {
  if (!token) return false;
  const db = read();
  const s = db.sessions?.[token];
  if (!s || s.expires < Date.now()) return false;
  return true;
}

export function destroySession(token) {
  const db = read();
  if (db.sessions?.[token]) {
    delete db.sessions[token];
    write(db);
  }
}

export function stats() {
  const orders = listOrders();
  const delivered = orders.filter((o) => o.status === "delivered" || !o.status);
  const revenue = delivered.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => o.createdAt >= today.getTime());
  return {
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    revenue: Math.round(revenue * 100) / 100,
    pending: orders.filter((o) => o.status === "pending").length,
  };
}
