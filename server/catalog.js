/**
 * Storefront catalog built live from Khmer TopUp (GET /games).
 * Admin chooses which games / packages to sell + markup (Admin → Services).
 */
import { getSettings } from "./store.js";
import * as khmerTopup from "./khmerTopup.js";
import * as dinoTopup from "./dinoTopup.js";
import { localCatalog, findLocalPack, cleanBanners } from "./localProducts.js";

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

let inflight = null;

/** One shared request to the supplier — concurrent callers reuse it instead of each waiting on their own. */
function refresh() {
  if (inflight) return inflight;
  inflight = khmerTopup
    .listGames()
    .then((data) => {
      const list = Array.isArray(data) ? data : data.games || data.data || [];
      cache = { at: Date.now(), games: list.map(normalizeGame).filter((g) => g.slug), raw: list };
      return cache.games;
    })
    .catch((e) => {
      if (!cache.games) throw e;
      cache.at = Date.now() - TTL + 15_000; // serve stale, retry in 15s
      return cache.games;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Stale-while-revalidate: once loaded, customers always get the cached list instantly;
 * an expired cache is refreshed in the background instead of making the next customer wait.
 */
export async function fetchSupplierGames(force = false) {
  if (force) return refresh();
  if (cache.games) {
    if (Date.now() - cache.at >= TTL) refresh().catch(() => {});
    return cache.games;
  }
  return refresh();
}

/** Call at startup so the first customer doesn't pay for the cold supplier request. */
export function warmCatalog() {
  if (!khmerTopup.isTopupReady()) return;
  refresh().catch((e) => console.warn("[catalog] warm-up failed:", e.message));
  setInterval(() => {
    if (Date.now() - cache.at >= TTL - 5_000) refresh().catch(() => {});
  }, TTL / 2).unref();
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
    // Show all known games; enabled=false → open:false (OFF / MAINTENANCE on storefront)
    const isOpen = !!s?.enabled;
    const hasOwn = s && s.markup !== undefined && s.markup !== null && s.markup !== "" && Number.isFinite(Number(s.markup));
    const markup = hasOwn ? Number(s.markup) : globalMarkup;
    const allowed = Array.isArray(s?.packages) ? new Set(s.packages.map(String)) : null;

    const packPrices = (s && s.packPrices) || {};
    const packs = (g.packs || [])
      .filter((p) => p.inStock && (!allowed || allowed.has(p.id)))
      .map((p) => {
        const pid = String(p.id);
        const cost = Number(p.cost) || 0;
        const fixed = packPrices[pid];
        const price =
          fixed != null && Number.isFinite(Number(fixed)) && Number(fixed) >= 0
            ? Math.round(Number(fixed) * 100) / 100
            : sellPrice(cost, markup);
        return {
          id: p.id,
          name: p.name,
          nameKm: p.name,
          price,
          cost,
          category: p.category,
          bonus: p.bonus,
          image: (s && (s.packImages?.[p.id] || s.packIcon)) || p.image || "",
        };
      });

    // OFF games are hidden from the website unless the admin chose "show as OFF" for that game
    if (!isOpen && !s?.showWhenOff) continue;
    if (!s && !packs.length) continue;
    if (isOpen && !packs.length) continue;

    out.push({
      id: g.slug,
      name: g.name,
      nameKm: g.name,
      image: (s && s.image) || g.image,
      banners: cleanBanners(s?.banners, s?.banner),
      banner: cleanBanners(s?.banners, s?.banner)[0] || "",
      mark: markOf(g.name),
      hue: hueOf(g.slug),
      famous: !!(s && s.featured),
      hot: !!(s && s.featured),
      open: isOpen,
      showWhenOff: !!s?.showWhenOff,
      hasZone: g.hasZone,
      zoneLabelKm: "Zone ID",
      zoneLabelEn: "Zone ID",
      servers: g.servers,
      idHintKm: g.hint,
      idHintEn: g.hint,
      numericId: g.numericId,
      packs: isOpen ? packs : packs, // keep packs for display; checkout blocked by open
    });
  }
  return out;
}


/** Dino games the admin enabled (dinoSelection) — for storefront */
export async function dinoStorefront() {
  if (!dinoTopup.isDinoReady()) return [];
  const settings = getSettings();
  const sel = settings.dinoSelection || {};
  const globalMarkup = Number(sel.markupPercent) || 0;
  // Always list enabled Dino games on Home when API key is set.
  // topupProvider only controls which API is used for auto-fulfill after pay.
  let supplier = [];
  try {
    const data = await dinoTopup.listProducts();
    supplier = dinoTopup.normalizeGamesPayload(data);
  } catch (e) {
    console.warn("[catalog] dino list failed:", e.message);
    return [];
  }

  const out = [];
  for (const g of supplier) {
    const s = sel.games?.[g.slug] || sel.games?.[String(g.slug).toLowerCase()];
    const isOpen = !!s?.enabled;
    if (!isOpen && !s?.showWhenOff) continue;

    const hasOwn = s && s.markup !== undefined && s.markup !== null && s.markup !== "" && Number.isFinite(Number(s.markup));
    const markup = hasOwn ? Number(s.markup) : globalMarkup;
    const allowed = Array.isArray(s?.packages) ? new Set(s.packages.map(String)) : null;

    const packPrices = (s && s.packPrices) || {};
    const packs = (g.packs || [])
      .filter((p) => p.inStock !== false && (!allowed || allowed.has(String(p.id))))
      .map((p) => {
        const pid = String(p.id);
        const cost = Number(p.cost) || 0;
        const fixed = packPrices[pid];
        const price =
          fixed != null && Number.isFinite(Number(fixed)) && Number(fixed) >= 0
            ? Math.round(Number(fixed) * 100) / 100
            : sellPrice(cost, markup);
        return {
          id: pid,
          name: p.name,
          nameKm: p.name,
          price,
          cost,
          category: p.category || "Diamonds",
          image: (s && (s.packImages?.[p.id] || s.packIcon)) || p.image || "",
        };
      });

    if (isOpen && !packs.length) continue;

    out.push({
      id: g.slug,
      name: g.name,
      nameKm: g.name,
      image: (s && s.image) || g.image || "",
      banners: cleanBanners(s?.banners, s?.banner),
      banner: cleanBanners(s?.banners, s?.banner)[0] || "",
      mark: markOf(g.name),
      hue: hueOf(g.slug),
      famous: !!(s && s.featured),
      hot: !!(s && s.featured),
      open: isOpen,
      showWhenOff: !!s?.showWhenOff,
      hasZone: !!g.needsZone,
      zoneLabelKm: "Zone ID",
      zoneLabelEn: "Zone ID",
      servers: [],
      idHintKm: "",
      idHintEn: "",
      provider: "dino",
      dinoId: g.slug,
      packs: packs,
    });
  }
  return out;
}


export async function publicCatalog() {
  const [khmerGames, dinoGames] = await Promise.all([
    storefront().catch(() => []),
    dinoStorefront().catch(() => []),
  ]);

  const local = localCatalog()
    .filter((g) => g.open !== false || g.showWhenOff)
    .map((g) => ({
      ...g,
      packs: g.packs.map(({ cost, ...p }) => p),
    }));

  // Merge: local first, then Khmer, then Dino (skip dino slug already present from Khmer)
  const seen = new Set(local.map((g) => String(g.id)));
  const merged = [];
  for (const g of khmerGames) {
    const id = String(g.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push({ ...g, packs: g.packs.map(({ cost, ...p }) => p), provider: g.provider || "khmer" });
  }
  for (const g of dinoGames) {
    const id = String(g.id);
    // Both mode: if same slug enabled on both, prefer Dino when dino open
    if (seen.has(id)) {
      const idx = merged.findIndex((x) => String(x.id) === id);
      if (idx >= 0 && g.open) {
        merged[idx] = { ...g, packs: g.packs.map(({ cost, ...p }) => p) };
      }
      continue;
    }
    seen.add(id);
    merged.push({ ...g, packs: g.packs.map(({ cost, ...p }) => p) });
  }
  return [...local, ...merged];
}

export async function findPack(gameId, packId) {
  const local = findLocalPack(gameId, packId);
  if (local) return local;
  // Prefer full public catalog (Khmer + Dino)
  const all = await publicCatalog();
  const game = all.find((g) => String(g.id) === String(gameId));
  if (!game) return null;
  // re-fetch with cost for checkout: try storefronts that keep cost
  const withCost =
    (await storefront()).find((g) => String(g.id) === String(gameId)) ||
    (await dinoStorefront()).find((g) => String(g.id) === String(gameId));
  const g = withCost || game;
  const pack = (g.packs || []).find((p) => String(p.id) === String(packId));
  return pack ? { game: g, pack } : null;
}

export async function findGame(gameId) {
  const local = localCatalog().find((g) => g.id === String(gameId));
  if (local) return local;
  const fromKt = (await storefront()).find((g) => String(g.id) === String(gameId));
  if (fromKt) return fromKt;
  const fromDino = (await dinoStorefront()).find((g) => String(g.id) === String(gameId));
  return fromDino || null;
}

/** Only allow our own uploads or https URLs as image sources. */
function cleanImg(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^\/uploads\/[\w.-]{1,120}$/.test(s)) return s;
  if (/^\/icons\/[\w.-]{1,80}$/.test(s)) return s;
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
    const packPrices = {};
    for (const [pid, pr] of Object.entries(v?.packPrices || {}).slice(0, 2000)) {
      const n = Number(pr);
      if (String(pid).length <= 80 && Number.isFinite(n) && n >= 0 && n <= 100000) {
        packPrices[String(pid)] = Math.round(n * 100) / 100;
      }
    }
    out.games[slug] = {
      enabled: !!v?.enabled,
      showWhenOff: !!v?.showWhenOff,
      featured: !!v?.featured,
      markup: mkNum !== null && Number.isFinite(mkNum) ? Math.min(500, Math.max(0, mkNum)) : null,
      packages: Array.isArray(v?.packages) ? v.packages.map(String).slice(0, 2000) : null,
      packPrices: Object.keys(packPrices).length ? packPrices : undefined,
      image: cleanImg(v?.image),
      banners: cleanBanners(v?.banners, v?.banner),
      banner: cleanBanners(v?.banners, v?.banner)[0] || "",
      packIcon: cleanImg(v?.packIcon),
      packImages,
    };
  }
  return out;
}


/**
 * Apply fixed reseller pack prices (USD) for a logged-in reseller user.
 * settings.resellerPrices = { packId: number }
 * settings.resellers = [{ username, telegramId, active }]
 */
export function isResellerUser(settings, tgUser) {
  if (!tgUser) return false;
  const list = Array.isArray(settings?.resellers) ? settings.resellers : [];
  const uname = String(tgUser.username || "").toLowerCase().replace(/^@/, "");
  const tid = Number(tgUser.id) || 0;
  return list.some((r) => {
    if (r && r.active === false) return false;
    const ru = String(r.username || "").toLowerCase().replace(/^@/, "");
    const rid = Number(r.telegramId) || 0;
    if (tid && rid && tid === rid) return true;
    if (uname && ru && uname === ru) return true;
    return false;
  });
}

export function resellerFixedPrice(settings, packId) {
  const map = settings?.resellerPrices || {};
  const v = Number(map[String(packId)]);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

export function applyResellerToCatalog(games, settings, tgUser) {
  if (!isResellerUser(settings, tgUser)) return { games, isReseller: false };
  const out = (games || []).map((g) => ({
    ...g,
    packs: (g.packs || []).map((p) => {
      const rp = resellerFixedPrice(settings, p.id);
      if (rp == null) return p;
      return { ...p, price: rp, resellerPrice: true, retailPrice: p.price };
    }),
  }));
  return { games: out, isReseller: true };
}
