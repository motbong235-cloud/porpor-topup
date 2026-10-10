/**
 * Local products (not from Khmer TopUp) — e.g. Roblox Gift Cards.
 * Delivery: gift_code → after payment customer contacts Live Chat / Telegram for the code.
 * Admin pastes the code on the order (Admin → Orders).
 */
import { getSettings } from "./store.js";

/** Default Roblox Gift Card packs (USD face value). Admin can override prices in settings.localProducts */
export const DEFAULT_LOCAL_PRODUCTS = [
  {
    id: "roblox-gift-cards",
    name: "Roblox Gift Cards",
    nameKm: "Roblox Gift Cards",
    region: "Cambodia / Global",
    blurbKm: "កាតអំណោយ Roblox — បង់រួចទទួលកូដតាម Live Chat / Telegram",
    blurbEn: "Roblox gift cards — pay then receive your code via Live Chat / Telegram",
    famous: true,
    hot: true,
    open: true,
    hue: 210,
    mark: "RBX",
    image: "",
    deliveryType: "gift_code", // no player ID; code via chat
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "មិនចាំបាច់ ID ហ្គេម — បង់រួចទាក់ទង Live Chat ដើម្បីទទួលកូដ",
    idHintEn: "No game ID needed — after payment contact Live Chat for your code",
    packs: [
      { id: "rbx-5", name: "Roblox $5 Gift Card", nameKm: "Roblox $5 Gift Card", price: 5.5, cost: 5, category: "Gift Card", bonus: "" },
      { id: "rbx-10", name: "Roblox $10 Gift Card", nameKm: "Roblox $10 Gift Card", price: 10.5, cost: 10, category: "Gift Card", bonus: "" },
      { id: "rbx-25", name: "Roblox $25 Gift Card", nameKm: "Roblox $25 Gift Card", price: 25.5, cost: 25, category: "Gift Card", bonus: "" },
    ],
  },
];

export function localCatalog() {
  const s = getSettings();
  const overrides = Array.isArray(s.localProducts) ? s.localProducts : null;
  const list = overrides && overrides.length ? overrides : DEFAULT_LOCAL_PRODUCTS;
  return list
    .filter((g) => g && g.open !== false)
    .map((g) => ({
      id: String(g.id),
      name: String(g.name || g.id),
      nameKm: String(g.nameKm || g.name || g.id),
      region: String(g.region || ""),
      blurbKm: String(g.blurbKm || ""),
      blurbEn: String(g.blurbEn || ""),
      famous: !!g.famous,
      hot: !!g.hot,
      open: g.open !== false,
      hue: Number(g.hue) || 210,
      mark: String(g.mark || "GC"),
      image: String(g.image || ""),
      deliveryType: g.deliveryType || "gift_code",
      hasZone: false,
      servers: [],
      numericId: false,
      idHintKm: String(g.idHintKm || ""),
      idHintEn: String(g.idHintEn || ""),
      packs: (Array.isArray(g.packs) ? g.packs : []).map((p) => ({
        id: String(p.id),
        name: String(p.name || p.id),
        nameKm: String(p.nameKm || p.name || p.id),
        price: Number(p.price),
        cost: Number(p.cost ?? p.price),
        category: String(p.category || "Gift Card"),
        bonus: p.bonus ? String(p.bonus) : "",
        image: String(p.image || ""),
      })).filter((p) => p.id && Number.isFinite(p.price) && p.price > 0),
    }))
    .filter((g) => g.packs.length);
}

export function findLocalPack(gameId, packId) {
  const game = localCatalog().find((g) => g.id === String(gameId));
  if (!game) return null;
  const pack = game.packs.find((p) => p.id === String(packId));
  return pack ? { game, pack } : null;
}

export function isGiftCodeProduct(game) {
  return game && (game.deliveryType === "gift_code" || String(game.id || "").startsWith("roblox"));
}
