/**
 * Storefront catalog built live from Khmer TopUp (GET /games).
 * Admin chooses which games / packages to sell + markup (Admin → Services).
 */
import { getSettings } from "./store.js";
import * as khmerTopup from "./khmerTopup.js";

const TTL = 60_000;
let cache = { at: 0, games: null, raw: null };

function pick(o, keys) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
}

function hueOf(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 195 + (h % 40); // keep the blue brand range
}

function markOf(name) {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}

export function normalizeGame(g) {
  const slug = String(pick(g, ["slug", "code", "key", "id"]) ?? "");
  const name = String(pick(g, ["name", "title"]) ?? slug);
  const rawPacks = pick(g, ["packages", "products", "items", "denominations", "packs"]) || [];

  const packs = (Array.isArray(rawPacks) ? rawPacks : [])
    .map((p) => {
      const active = pick(p, ["active", "available", "in_stock", "enabled"]);
      return {
        id: String(pick(p, ["id", "package_id", "packageId"]) ?? ""),
        name: String(pick(p, ["name", "title", "label"]) ?? ""),
        cost: Number(pick(p, ["price", "cost", "amount", "unit_price"])),
        category: String(pick(p, ["category", "type", "group"]) ?? "Packages"),
        bonus: pick(p, ["bonus"]) ? String(pick(p, ["bonus"])) : "",
        image: String(pick(p, ["image", "image_url", "icon", "icon_url", "thumbnail"]) ?? ""),
        inStock: active === undefined ? true : !!active,
      };
    })
    .filter((p) => p.id && Number.isFinite(p.cost) && p.cost > 0);

  const serversRaw = pick(g, ["servers", "server_list", "regions"]);
  const servers = Array.isArray(serversRaw)
    ? serversRaw
        .map((s) =>
          typeof s === "object"
            ? { value: String(pick(s, ["id", "value", "code"]) ?? ""), label: String(pick(s, ["name", "label", "title"]) ?? pick(s, ["id", "value", "code"]) ?? "") }
            : { value: String(s), label: String(s) },
        )
        .filter((s) => s.value)
    : [];

  const flag = !!pick(g, ["requires_server", "server_required", "needs_server", "has_zone", "requires_zone"]);
  const hasZone = servers.length === 0 && (flag || /mobile legends|magic chess/i.test(name));

  return {
    slug,
    name,
    image: String(pick(g, ["image", "image_url", "icon", "icon_url", "logo", "logo_url", "thumbnail"]) ?? ""),
    hint: String(pick(g, ["id_hint", "hint", "description"]) ?? ""),
    hasZone,
    servers,
    numericId: pick(g, ["numeric_id"]) === undefined ? false : !!pick(g, ["numeric_id"]),
    packs,
  };
}

export async function fetchSupplierGames(force = false) {
  if (!force && cache.games && Date.now() - cache.at < TTL) return cache.games;
  try {
    const data = await khmerTopup.listGames();
    const list = Array.isArray(data) ? data : data.games || data.data || [];
    cache = { at: Date.now(), games: list.map(normalizeGame).filter((g) => g.slug), raw: list };
  } catch (e) {
    if (!cache.games) throw e;
    cache.at = Date.now() - TTL + 15_000; // serve stale, retry in 15s
  }
  return cache.games;
}

export function rawSupplierGames() {
  return cache.raw;
}

export function sellPrice(cost, markupPercent) {
  const m = Number(markupPercent) || 0;
  return Math.ceil(cost * (1 + m / 100) * 100 - 1e-9) / 100;
}

/** Games + packages the admin enabled, priced for customers (includes `cost`, strip before sending). */
export async function storefront() {
  const sel = getSettings().ktSelection || {};
  const globalMarkup = Number(sel.markupPercent) || 0;
  const supplier = await fetchSupplierGames();
  const out = [];

  for (const g of supplier) {
    const s = sel.games?.[g.slug];
    if (!s?.enabled) continue;
    const hasOwn = s.markup !== undefined && s.markup !== null && s.markup !== "" && Number.isFinite(Number(s.markup));
    const markup = hasOwn ? Number(s.markup) : globalMarkup;
    const allowed = Array.isArray(s.packages) ? new Set(s.packages.map(String)) : null;

    const packs = g.packs
      .filter((p) => p.inStock && (!allowed || allowed.has(p.id)))
      .map((p) => ({
        id: p.id,
        name: p.name,
        nameKm: p.name,
        price: sellPrice(p.cost, markup),
        cost: p.cost,
        category: p.category,
        bonus: p.bonus,
        // priority: image uploaded for this package → game's default package image → supplier image
        image: s.packImages?.[p.id] || s.packIcon || p.image || "",
      }));
    if (!packs.length) continue;

    out.push({
      id: g.slug,
      name: g.name,
      nameKm: g.name,
      image: s.image || g.image,
      mark: markOf(g.name),
      hue: hueOf(g.slug),
      famous: !!s.featured,
      hot: !!s.featured,
      open: true,
      hasZone: g.hasZone,
      zoneLabelKm: "Zone ID",
      zoneLabelEn: "Zone ID",
      servers: g.servers,
      idHintKm: g.hint,
      idHintEn: g.hint,
      numericId: g.numericId,
      packs,
    });
  }
  return out;
}

export async function publicCatalog() {
  const games = await storefront();
  return games.map((g) => ({ ...g, packs: g.packs.map(({ cost, ...p }) => p) }));
}

export async function findPack(gameId, packId) {
  const game = (await storefront()).find((g) => g.id === String(gameId));
  if (!game) return null;
  const pack = game.packs.find((p) => p.id === String(packId));
  return pack ? { game, pack } : null;
}

export async function findGame(gameId) {
  return (await storefront()).find((g) => g.id === String(gameId)) || null;
}

/** Only allow our own uploads or https URLs as image sources. */
function cleanImg(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^\/uploads\/[\w.-]{1,100}$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,490}$/.test(s)) return s;
  return "";
}

export function sanitizeSelection(input) {
  const out = { markupPercent: 0, games: {} };
  const m = Number(input?.markupPercent);
  out.markupPercent = Number.isFinite(m) ? Math.min(500, Math.max(0, m)) : 0;
  for (const [slug, v] of Object.entries(input?.games || {})) {
    if (typeof slug !== "string" || !slug || slug.length > 120) continue;
    const mk = v?.markup;
    const mkNum = mk === "" || mk === null || mk === undefined ? null : Number(mk);
    const packImages = {};
    for (const [pid, url] of Object.entries(v?.packImages || {}).slice(0, 2000)) {
      const clean = cleanImg(url);
      if (clean && String(pid).length <= 60) packImages[String(pid)] = clean;
    }
    out.games[slug] = {
      enabled: !!v?.enabled,
      featured: !!v?.featured,
      markup: mkNum !== null && Number.isFinite(mkNum) ? Math.min(500, Math.max(0, mkNum)) : null,
      packages: Array.isArray(v?.packages) ? v.packages.map(String).slice(0, 2000) : null,
      image: cleanImg(v?.image),
      packIcon: cleanImg(v?.packIcon),
      packImages,
    };
  }
  return out;
}
