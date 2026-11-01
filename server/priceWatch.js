/**
 * Khmer TopUp cost price tracker — snapshot + diff (up / down)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as catalog from "./catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "kt-price-history.json");
const MAX_SNAPS = 60;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { snapshots: [] };
  }
}

function write(db) {
  ensure();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 0));
  fs.renameSync(tmp, FILE);
}

/** Flatten games → map packId -> { game, pack, cost } */
function flatten(games) {
  const map = {};
  for (const g of games || []) {
    for (const p of g.packs || []) {
      const id = String(p.id);
      map[id] = {
        packId: id,
        packName: p.name || id,
        gameSlug: g.slug || g.id,
        gameName: g.name || g.slug,
        cost: Number(p.cost) || 0,
      };
    }
  }
  return map;
}

export async function takeSnapshot({ force = false } = {}) {
  const games = await catalog.fetchSupplierGames(true);
  const prices = flatten(games);
  const db = read();
  const last = db.snapshots[db.snapshots.length - 1];
  // skip if identical within 2 min unless force
  if (!force && last && Date.now() - last.at < 120_000) {
    const same =
      Object.keys(prices).length === Object.keys(last.prices || {}).length &&
      Object.keys(prices).every((k) => Number(last.prices[k]?.cost) === Number(prices[k]?.cost));
    if (same) return { skipped: true, snapshot: last, changes: [] };
  }
  const snap = {
    at: Date.now(),
    count: Object.keys(prices).length,
    prices,
  };
  db.snapshots.push(snap);
  if (db.snapshots.length > MAX_SNAPS) db.snapshots = db.snapshots.slice(-MAX_SNAPS);
  write(db);
  const changes = last ? diffSnapshots(last, snap) : [];
  return { skipped: false, snapshot: snap, changes, previousAt: last?.at || null };
}

export function listSnapshots(limit = 20) {
  const db = read();
  return db.snapshots.slice(-limit).map((s) => ({
    at: s.at,
    count: s.count,
  }));
}

export function diffSnapshots(prev, curr) {
  const a = prev?.prices || {};
  const b = curr?.prices || {};
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changes = [];
  for (const id of ids) {
    const before = a[id];
    const after = b[id];
    if (!before && after) {
      changes.push({
        type: "new",
        packId: id,
        packName: after.packName,
        gameName: after.gameName,
        gameSlug: after.gameSlug,
        from: null,
        to: after.cost,
        delta: after.cost,
        pct: null,
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        type: "removed",
        packId: id,
        packName: before.packName,
        gameName: before.gameName,
        gameSlug: before.gameSlug,
        from: before.cost,
        to: null,
        delta: -before.cost,
        pct: -100,
      });
      continue;
    }
    if (!before || !after) continue;
    const d = Number((after.cost - before.cost).toFixed(4));
    if (Math.abs(d) < 0.00005) continue;
    const pct = before.cost ? Number(((d / before.cost) * 100).toFixed(2)) : null;
    changes.push({
      type: d > 0 ? "up" : "down",
      packId: id,
      packName: after.packName || before.packName,
      gameName: after.gameName || before.gameName,
      gameSlug: after.gameSlug || before.gameSlug,
      from: before.cost,
      to: after.cost,
      delta: d,
      pct,
    });
  }
  changes.sort((x, y) => Math.abs(y.delta || 0) - Math.abs(x.delta || 0));
  return changes;
}

/** Compare latest snapshot to the one before (or rebuild live vs last) */
export async function latestChanges() {
  const db = read();
  if (db.snapshots.length < 1) {
    const r = await takeSnapshot({ force: true });
    return {
      changes: [],
      currentAt: r.snapshot.at,
      previousAt: null,
      message: "snapshot_first",
    };
  }
  // live fetch vs last snapshot
  const games = await catalog.fetchSupplierGames(true);
  const live = { at: Date.now(), count: 0, prices: flatten(games) };
  live.count = Object.keys(live.prices).length;
  const prev = db.snapshots[db.snapshots.length - 1];
  const changes = diffSnapshots(prev, live);
  return {
    changes,
    currentAt: live.at,
    previousAt: prev.at,
    liveCount: live.count,
    prevCount: prev.count,
  };
}

export function historyBetween(fromAt, toAt) {
  const db = read();
  const snaps = db.snapshots.filter((s) => {
    if (fromAt && s.at < fromAt) return false;
    if (toAt && s.at > toAt) return false;
    return true;
  });
  if (snaps.length < 2) return { changes: [], snapshots: snaps.map((s) => ({ at: s.at, count: s.count })) };
  const changes = diffSnapshots(snaps[0], snaps[snaps.length - 1]);
  return {
    changes,
    snapshots: snaps.map((s) => ({ at: s.at, count: s.count })),
    fromAt: snaps[0].at,
    toAt: snaps[snaps.length - 1].at,
  };
}
