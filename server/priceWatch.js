/**
 * Cost price tracker for Khmer TopUp + Fox Topups — snapshot + diff (up / down)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as catalog from "./catalog.js";
import * as foxTopup from "./foxTopup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const MAX_SNAPS = 60;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(provider) {
  const p = String(provider || "khmer").toLowerCase() === "fox" ? "fox" : "khmer";
  return path.join(DATA_DIR, p === "fox" ? "fox-price-history.json" : "kt-price-history.json");
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
  const payload = JSON.stringify(db);
  try {
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, FILE);
  } catch (e) {
    // fallback if rename not allowed
    try {
      fs.writeFileSync(FILE, payload);
    } catch (e2) {
      throw new Error("Cannot write price history: " + (e2.message || e.message));
    }
  }
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

async function fetchFoxGames() {
  if (!foxTopup.isFoxReady()) {
    throw Object.assign(new Error("Fox Topup not configured (FOX_TOPUP_UID + FOX_TOPUP_API_KEY)"), { code: "not_configured" });
  }
  const raw = await foxTopup.listGames();
  const games = foxTopup.normalizeGamesPayload(raw);
  const arr = raw.games || raw.data?.games || (Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : []);
  const have = new Set(games.map((g) => String(g.slug)));
  for (const g of arr) {
    const code = String(g?.code || g?.id || g?.slug || "");
    if (!code || have.has(code)) continue;
    try {
      for (const x of foxTopup.normalizeGamesPayload(await foxTopup.getGame(code))) {
        if (!have.has(x.slug)) {
          have.add(x.slug);
          games.push(x);
        }
      }
    } catch {
      /* skip */
    }
  }
  return games;
}

async function fetchGames(provider) {
  return String(provider).toLowerCase() === "fox" ? fetchFoxGames() : fetchKhmerGames();
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
