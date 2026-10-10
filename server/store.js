import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const DEFAULT_SETTINGS = {
  siteName: "POR POR TOPUP",
  taglineKm: "ហាងហ្គេមព្រីមៀម",
  taglineEn: "PREMIUM GAME STORE",
  telegram: "https://t.me/porportopup",
  announcementKm: "",
  announcementEn: "",
  supportEmail: "support@porportopup.com",
  maintenance: false,
  /** Site logo (uploaded via Admin → Settings) — "" = use the default "PP" mark */
  logoUrl: "",
  /** Homepage banner images (max 5) — empty = use the built-in gradient slides */
  bannerUrls: [],
  coupons: [
    { code: "PORPOR10", type: "percent", value: 10, min: 0 },
    { code: "BLUE", type: "fixed", value: 0.5, min: 2 },
  ],
  /** When true and keys set, auto-order on Khmer TopUp after payment */
  autoTopup: true,
  /** Which Khmer TopUp games/packages to sell (Admin → Services) */
  ktSelection: { markupPercent: 0, games: {} },
  /** Local services (gift cards etc.) managed in Admin → Services */
  localProducts: [],
};

const LEGACY_KEYS = ["defaultWallet", "closedGames", "packageMap", "allowDemoPay"];

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    // db.json damaged (e.g. crash mid-write) — fall back to the last good backup
    try {
      return JSON.parse(fs.readFileSync(DB_FILE + ".bak", "utf8"));
    } catch {
      return { settings: { ...DEFAULT_SETTINGS }, orders: [], sessions: {} };
    }
  }
}

/** Atomic write (tmp file + rename) with a rolling backup, so saved services never get lost half-written. */
function write(db) {
  ensure();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  try {
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_FILE + ".bak");
  } catch {}
  fs.renameSync(tmp, DB_FILE);
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
  const st = (o) => o.status || "delivered";
  const delivered = orders.filter((o) => st(o) === "delivered");
  const sum = (arr, f) => arr.reduce((n, o) => n + (Number(f(o)) || 0), 0);
  const revenue = sum(delivered, (o) => o.total);
  const profit = sum(delivered, (o) => (Number(o.total) || 0) - (Number(o.cost) || 0));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = startOfDay.getTime();

  const byStatus = {};
  for (const o of orders) byStatus[st(o)] = (byStatus[st(o)] || 0) + 1;

  // last 7 days (oldest → newest)
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const from = today - i * 86400000;
    const to = from + 86400000;
    const day = orders.filter((o) => o.createdAt >= from && o.createdAt < to);
    const done = day.filter((o) => st(o) === "delivered");
    daily.push({
      date: from,
      orders: day.length,
      revenue: Math.round(sum(done, (o) => o.total) * 100) / 100,
    });
  }

  return {
    totalOrders: orders.length,
    todayOrders: orders.filter((o) => o.createdAt >= today).length,
    revenue: Math.round(revenue * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    pending: byStatus.pending || 0,
    byStatus,
    daily,
  };
}
