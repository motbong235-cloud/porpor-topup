/**
 * Cost price tracker for Khmer TopUp + Dino Topups — snapshot + diff (up / down)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as catalog from "./catalog.js";
import * as dinoTopup from "./dinoTopup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const MAX_SNAPS = 60;
const GAMES_DINO = ["ml", "ff", "pubg", "hok", "genshin", "roblox"];

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(provider) {
  const p = String(provider || "khmer").toLowerCase() === "dino" ? "dino" : "khmer";
  return path.join(DATA_DIR, p === "dino" ? "dino-price-history.json" : "kt-price-history.json");
}

function read(provider) {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(fileFor(provider), "utf8"));
  } catch {
    return { snapshots: [] };
  }
}

function write(provider, db) {
  ensure();
  const FILE = fileFor(provider);
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 0));
  fs.renameSync(tmp, FILE);
}

function flatten(games) {
  const map = {};
  for (const g of games || []) {
    for (const p of g.packs || []) {
      const id = String(p.id);
      const key = `${g.slug || g.id}::${id}`;
      map[key] = {
        key,
        packId: id,
        packName: p.name || id,
        gameSlug: g.slug || g.id,
        gameName: g.name || g.slug,
        cost: Number(p.cost ?? p.price) || 0,
      };
    }
  }
  return map;
}

async function fetchKhmerGames() {
  return catalog.fetchSupplierGames(true);
}

async function fetchDinoGames() {
  if (!dinoTopup.isDinoReady()) {
    throw Object.assign(new Error("DINO_TOPUP_API_KEY not set"), { code: "not_configured" });
  }
  const games = [];
  for (const gid of GAMES_DINO) {
    try {
      const data = await dinoTopup.listProducts(gid);
      const list = data.games || data.data?.games || (Array.isArray(data) ? data : []);
      const arr = list.length ? list : data.id ? [data] : [];
      for (const g of arr) {
        const id = String(g.id || gid);
        const packs = (g.products || g.packs || []).map((p) => ({
          id: String(p.id),
          name: String(p.name || p.id),
          cost: Number(p.price || p.cost || 0),
          price: Number(p.price || 0),
        }));
        if (!packs.length) continue;
        games.push({ slug: id, name: String(g.name || id), packs });
      }
    } catch {
      /* skip */
    }
  }
  const seen = new Set();
  return games.filter((g) => {
    if (seen.has(g.slug)) return false;
    seen.add(g.slug);
    return true;
  });
}

async function fetchGames(provider) {
  return String(provider).toLowerCase() === "dino" ? fetchDinoGames() : fetchKhmerGames();
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
        packId: after.packId,
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
        packId: before.packId,
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
      packId: after.packId || before.packId,
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

export async function takeSnapshot(provider = "khmer", { force = false } = {}) {
  const games = await fetchGames(provider);
  const prices = flatten(games);
  const db = read(provider);
  const last = db.snapshots[db.snapshots.length - 1];
  if (!force && last && Date.now() - last.at < 120_000) {
    const same =
      Object.keys(prices).length === Object.keys(last.prices || {}).length &&
      Object.keys(prices).every((k) => Number(last.prices[k]?.cost) === Number(prices[k]?.cost));
    if (same) return { skipped: true, snapshot: last, changes: [], provider };
  }
  const snap = { at: Date.now(), count: Object.keys(prices).length, prices };
  db.snapshots.push(snap);
  if (db.snapshots.length > MAX_SNAPS) db.snapshots = db.snapshots.slice(-MAX_SNAPS);
  write(provider, db);
  const changes = last ? diffSnapshots(last, snap) : [];
  return { skipped: false, snapshot: snap, changes, previousAt: last?.at || null, provider };
}

export function listSnapshots(provider = "khmer", limit = 20) {
  return read(provider)
    .snapshots.slice(-limit)
    .map((s) => ({ at: s.at, count: s.count }));
}

export async function latestChanges(provider = "khmer") {
  const db = read(provider);
  if (db.snapshots.length < 1) {
    const r = await takeSnapshot(provider, { force: true });
    return {
      changes: [],
      currentAt: r.snapshot.at,
      previousAt: null,
      message: "snapshot_first",
      provider,
    };
  }
  const games = await fetchGames(provider);
  const live = { at: Date.now(), prices: flatten(games) };
  live.count = Object.keys(live.prices).length;
  const prev = db.snapshots[db.snapshots.length - 1];
  return {
    changes: diffSnapshots(prev, live),
    currentAt: live.at,
    previousAt: prev.at,
    liveCount: live.count,
    prevCount: prev.count,
    provider,
  };
}
