/**
 * Local products (not Khmer TopUp).
 * deliveryType: "stock" | "live_chat"
 * requireUsername: true  → customer must enter username
 *                  false → no username field
 *
 * Safety net: set env USERNAME_REQUIRED_IDS=robux-login,roblox-plus on Render
 * to force the username field for those product ids regardless of saved settings.
 */
import { getSettings, stockCount } from "./store.js";

export const DEFAULT_LOCAL_PRODUCTS = [
  {
    id: "roblox-gift-cards",
    name: "Roblox Gift Cards",
    nameKm: "Roblox Gift Cards",
    region: "Cambodia / Global",
    blurbKm: "កាតអំណោយ Roblox — បង់រួចទទួលកូដស្វ័យប្រវត្តិ",
    blurbEn: "Roblox gift cards — instant code after payment",
    famous: true,
    hot: true,
    open: true,
    hue: 210,
    mark: "RBX",
    image: "",
    deliveryType: "stock",
    requireUsername: false,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "មិនចាំបាច់ username",
    idHintEn: "No username required",
    packs: [
      { id: "rbx-5", name: "Roblox $5", nameKm: "Roblox $5", price: 5.5, cost: 5, category: "Gift Card", bonus: "" },
      { id: "rbx-10", name: "Roblox $10", nameKm: "Roblox $10", price: 10.5, cost: 10, category: "Gift Card", bonus: "" },
      { id: "rbx-25", name: "Roblox $25", nameKm: "Roblox $25", price: 25.5, cost: 25, category: "Gift Card", bonus: "" },
    ],
  },
  {
    id: "mlbb-box-event",
    name: "Box MLBB Event Ticket",
    nameKm: "Box MLBB — សំបុត្រព្រឹត្តិការណ៍",
    region: "Cambodia / SEA",
    blurbKm: "កក់សំបុត្រ / Box ព្រឹត្តិការណ៍ Mobile Legends (Event · Carnival · Match). បង់រួច Admin ទាក់ទងតាម Live Chat ដើម្បីបញ្ជាក់ការកក់។",
    blurbEn: "Book MLBB event / carnival / match tickets (Box). After payment, admin confirms via Live Chat.",
    famous: true,
    hot: true,
    open: true,
    hue: 45,
    mark: "ML",
    image: "",
    deliveryType: "live_chat",
    requireUsername: true,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "បញ្ចូលឈ្មោះ + លេខទូរស័ព្ទ (ឬ Telegram) សម្រាប់ទំនាក់ទំនងកក់សំបុត្រ",
    idHintEn: "Enter name + phone (or Telegram) for ticket booking contact",
    packs: [
      { id: "mlbb-box-std", name: "Standard Box / Ticket", nameKm: "សំបុត្រធម្មតា (Standard)", price: 5, cost: 4, category: "Event Ticket", bonus: "1 seat" },
      { id: "mlbb-box-vip", name: "VIP Box / Ticket", nameKm: "សំបុត្រ VIP", price: 12, cost: 10, category: "Event Ticket", bonus: "VIP seat" },
      { id: "mlbb-box-premium", name: "Premium Box", nameKm: "Premium Box", price: 25, cost: 20, category: "Event Ticket", bonus: "Premium + merch" },
      { id: "mlbb-box-group", name: "Group Box (4 pax)", nameKm: "Group Box (៤ នាក់)", price: 40, cost: 32, category: "Event Ticket", bonus: "4 seats" },
    ],
  },
];

function normDelivery(dt) {
  if (dt === "live_chat") return "live_chat";
  if (dt === "topup") return "topup";
  // gift_code legacy → stock
  return "stock";
}

function forcedUsernameIds() {
  return String(process.env.USERNAME_REQUIRED_IDS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function localCatalog() {
  const s = getSettings();
  const overrides = Array.isArray(s.localProducts) ? s.localProducts : null;
  const list = overrides && overrides.length ? overrides : DEFAULT_LOCAL_PRODUCTS;
  const forced = forcedUsernameIds();
  return list
    .filter((g) => g && g.id)
    .map((g) => {
      const dt = normDelivery(g.deliveryType || "stock");
      const requireUsername = !!g.requireUsername || forced.includes(String(g.id).toLowerCase());
      return {
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
        deliveryType: dt,
        requireUsername,
        hasZone: false,
        servers: [],
        numericId: false,
        idHintKm: String(
          g.idHintKm ||
            (requireUsername ? "បញ្ចូល Username របស់អ្នក" : "មិនចាំបាច់ username"),
        ),
        idHintEn: String(
          g.idHintEn ||
            (requireUsername ? "Enter your username" : "No username required"),
        ),
        packs: (Array.isArray(g.packs) ? g.packs : [])
          .map((p) => {
            const id = String(p.id);
            const left = dt === "stock" ? stockCount(id) : 999;
            return {
              id,
              name: String(p.name || p.id),
              nameKm: String(p.nameKm || p.name || p.id),
              price: Number(p.price),
              cost: Number(p.cost ?? p.price),
              category: String(p.category || "Gift Card"),
              bonus: p.bonus ? String(p.bonus) : "",
              image: String(p.image || ""),
              stock: dt === "stock" ? left : null,
              inStock: dt === "live_chat" ? true : left > 0,
            };
          })
          .filter((p) => p.id && Number.isFinite(p.price) && p.price > 0),
      };
    })
    .filter((g) => g.packs.length);
}

export function findLocalPack(gameId, packId) {
  const game = localCatalog().find((g) => g.id === String(gameId));
  if (!game) return null;
  const pack = game.packs.find((p) => p.id === String(packId));
  return pack ? { game, pack } : null;
}

export function isGiftCodeProduct(game) {
  if (!game) return false;
  const dt = game.deliveryType;
  return dt === "stock" || dt === "live_chat" || dt === "gift_code" || String(game.id || "").startsWith("roblox");
}
