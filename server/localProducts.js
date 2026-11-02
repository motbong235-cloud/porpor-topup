/**
 * Local products (not Khmer TopUp).
 * deliveryType: "stock" | "live_chat" | "robux_send"
 * requireUsername: true  → customer must enter username
 *                  false → no username field
 *
 * Safety net: set env USERNAME_REQUIRED_IDS=robux-login,roblox-plus on Render
 * to force the username field for those product ids regardless of saved settings.
 */
import { getSettings, stockCount } from "./store.js";

/** Default product art when admin has not uploaded an image (keeps storefront looking finished). */
export function defaultProductImage(id, name = "") {
  const k = `${id || ""} ${name || ""}`.toLowerCase();
  if (/gift|gc|card/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-gift.svg";
  if (/plus|premium/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-plus.svg";
  if (/robux|login/.test(k)) return "/icons/robux.svg";
  if (/roblox|rbx/.test(k)) return "/icons/roblox.svg";
  if (/mlbb|mobile.?legends|ml\b/.test(k)) return "/icons/mlbb.svg";
  return "";
}


export const DEFAULT_LOCAL_PRODUCTS = [
  {
    id: "robux-login",
    name: "Robux Login",
    nameKm: "Robux Login",
    region: "Cambodia / Global",
    blurbKm: "Robux Login — បង់រួច Admin ដាក់ឲ្យតាម account",
    blurbEn: "Robux Login — delivered after payment",
    famous: true,
    hot: true,
    open: true,
    hue: 210,
    mark: "RBX",
    image: "/icons/robux.svg",
    banner: "",
    deliveryType: "live_chat",
    requireUsername: true,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "បញ្ចូល Username Roblox",
    idHintEn: "Enter Roblox username",
    packs: [
      { id: "robux-login-std", name: "Robux Login", nameKm: "Robux Login", price: 0.89, cost: 0.7, category: "Roblox", bonus: "" },
    ],
  },

  {
    id: "robux-send",
    name: "Robux Send",
    nameKm: "Robux Send",
    region: "Cambodia / Global",
    blurbKm: "ផ្ញើ Robux ទៅ Username — បង់រួច Admin ផ្ញើដោយដៃ (Live Chat · មិន auto)",
    blurbEn: "Send Robux to username — admin sends manually after pay (Live Chat · not auto)",
    famous: true,
    hot: true,
    open: true,
    hue: 200,
    mark: "SEND",
    image: "/icons/robux.svg",
    banner: "",
    deliveryType: "robux_send",
    requireUsername: true,
    idHintKm: "បង់រួចទទួល Order ID → ផ្ញើតាម Live Chat → Admin ផ្ញើ Robux (មិន auto)",
    idHintEn: "After pay get Order ID → Live Chat → Admin sends Robux (not auto)",
    safetyGuide: {
      enabled: true,
      titleKm: "សូមអានមុនអនុវត្ត",
      titleEn: "Please read before continuing",
      stepsKm: [
        "គណនី Roblox ត្រូវតែ Select, Uncheck ពី Kid មិនអាចទទួល Robux បានទេ។",
        "កុំឲ្យនរណាម្នាក់សុំពាក្យសម្ងាត់ ឬលេខកូដ 2FA។",
        "បន្ទាប់ពីបាន Robux រួច មិនអាចស្នើសុំសងប្រាក់ (Refund) បានទេ។",
      ],
      stepsEn: [
        "Roblox account must use Select and Uncheck Kid, or Robux cannot be received.",
        "Never share your password or 2FA codes with anyone.",
        "After Robux is delivered, refunds are not available.",
      ],
    },
    requireUsername: true,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "បញ្ចូល Username Roblox របស់អ្នកទទួល",
    idHintEn: "Enter recipient Roblox username",
    packs: [
      { id: "robux-send-80", name: "80 Robux", nameKm: "80 Robux", price: 0.89, cost: 0.7, category: "Robux", bonus: "" },
      { id: "robux-send-400", name: "400 Robux", nameKm: "400 Robux", price: 4.49, cost: 3.6, category: "Robux", bonus: "" },
      { id: "robux-send-800", name: "800 Robux", nameKm: "800 Robux", price: 8.99, cost: 7.2, category: "Robux", bonus: "" },
      { id: "robux-send-1700", name: "1700 Robux", nameKm: "1700 Robux", price: 17.99, cost: 14.5, category: "Robux", bonus: "" },
    ],
  },
  {
    id: "roblox-plus",
    name: "Roblox Plus",
    nameKm: "Roblox Plus",
    region: "Cambodia / Global",
    blurbKm: "Roblox Plus — បង់រួចទទួល",
    blurbEn: "Roblox Plus — after payment",
    famous: true,
    hot: true,
    open: true,
    hue: 350,
    mark: "PLUS",
    image: "/icons/roblox-plus.svg",
    banner: "",
    deliveryType: "live_chat",
    requireUsername: true,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "បញ្ចូល Username Roblox",
    idHintEn: "Enter Roblox username",
    packs: [
      { id: "roblox-plus-std", name: "Roblox Plus", nameKm: "Roblox Plus", price: 5.35, cost: 4.5, category: "Roblox", bonus: "" },
    ],
  },

  {
    id: "tiktok-khmer",
    name: "TikTok Khmer",
    nameKm: "TikTok Khmer",
    region: "Cambodia",
    blurbKm: "សេវា TikTok Khmer — បង់លើ website · order ចូល bot Kai-",
    blurbEn: "TikTok Khmer — pay on site · order notifies Kai- bot",
    famous: true,
    hot: true,
    open: true,
    hue: 340,
    mark: "TT",
    image: "/icons/tiktok.svg",
    banner: "",
    deliveryType: "live_chat",
    requireUsername: true,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "បញ្ចូល URL link video TikTok (គ្មាន Check ID) · បង់រួច order ចូល bot Kai-",
    idHintEn: "Paste TikTok video URL only (no Check ID) · after pay order goes to Kai- bot",
    packs: [
      { id: "ttk-01", name: "500-1K Likes | 1.8K Views", nameKm: "500-1K Likes | 1.8K Views", price: 0.99, cost: 0.5, category: "TikTok Like", bonus: "" },
      { id: "ttk-02", name: "1K-2K Likes | 3.5K Views", nameKm: "1K-2K Likes | 3.5K Views", price: 1.99, cost: 1.0, category: "TikTok Like", bonus: "" },
      { id: "ttk-03", name: "2K-3K Likes | 10K Views", nameKm: "2K-3K Likes | 10K Views", price: 3.25, cost: 1.6, category: "TikTok Like", bonus: "" },
      { id: "ttk-04", name: "3K-5K Likes | 20K Views", nameKm: "3K-5K Likes | 20K Views", price: 5.49, cost: 2.7, category: "TikTok Like", bonus: "" },
      { id: "ttk-05", name: "2K-5K Views", nameKm: "2K-5K Views", price: 0.99, cost: 0.5, category: "TikTok Views", bonus: "" },
      { id: "ttk-06", name: "100-200 Followers", nameKm: "100-200 Followers", price: 0.99, cost: 0.5, category: "TikTok Followers", bonus: "" },
    ],
  },
  {
    id: "roblox-gift-card",
    name: "Roblox Gift Card",
    nameKm: "Roblox Gift Card",
    region: "Cambodia / Global",
    blurbKm: "Roblox Gift Card — បង់រួចទទួលកូដ",
    blurbEn: "Roblox Gift Card — code after payment",
    famous: true,
    hot: true,
    open: true,
    hue: 270,
    mark: "GC",
    image: "/icons/roblox-gift.svg",
    banner: "",
    deliveryType: "stock",
    requireUsername: false,
    hasZone: false,
    servers: [],
    numericId: false,
    idHintKm: "មិនចាំបាច់ username",
    idHintEn: "No username required",
    packs: [
      { id: "rbx-gc-std", name: "Roblox Gift Card", nameKm: "Roblox Gift Card", price: 2.80, cost: 2.2, category: "Roblox", bonus: "" },
    ],
  },
];


/** Fallback icons for flagship products only when admin has not uploaded an image. */
function forcedImage(g) {
  const id = String(g?.id || "");
  const map = {
    "robux-login": "/icons/robux.svg",
    "roblox-plus": "/icons/roblox-plus.svg",
    "roblox-gift-card": "/icons/roblox-gift.svg",
    "roblox-gift-cards": "/icons/roblox-gift.svg",
  };
  if (map[id]) return map[id];
  // same-name products saved by admin with generic upload
  const n = String(g?.name || "").toLowerCase();
  if (n.includes("robux login")) return "/icons/robux.svg";
  if (n.includes("roblox plus") || n === "roblox plus") return "/icons/roblox-plus.svg";
  if (n.includes("gift card") && n.includes("roblox")) return "/icons/roblox-gift.svg";
  return "";
}

function defaultById(id) {
  const d = DEFAULT_LOCAL_PRODUCTS.find((x) => x.id === String(id));
  return (d && d.image) || "";
}

export const MAX_BANNERS = 5;
/** Only our own uploads or https image URLs. */
export function cleanImgUrl(u) {
  const s = String(u || "").trim();
  if (/^\/uploads\/[\w.-]{1,120}$/.test(s)) return s;
  if (/^\/icons\/[\w.-]{1,80}$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,490}$/.test(s)) return s;
  return "";
}
/** banners[] (max 5); falls back to the old single `banner` field. */
export function cleanBanners(list, legacy) {
  const src = Array.isArray(list) && list.length ? list : legacy ? [legacy] : [];
  return src.map(cleanImgUrl).filter(Boolean).slice(0, MAX_BANNERS);
}

/** Legacy "Gift Card" label is shown as "Roblox". */
export function normCategory(c) {
  const s = String(c || "").trim();
  return !s || s.toLowerCase() === "gift card" ? "Roblox" : s;
}

function normDelivery(dt) {
  if (dt === "live_chat") return "live_chat";
  if (dt === "robux_send") return "robux_send";
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
  let list;
  if (overrides && overrides.length) {
    // Always merge missing DEFAULT products (e.g. TikTok Khmer) onto Home
    const byId = new Map(overrides.map((g) => [String(g.id), g]));
    for (const d of DEFAULT_LOCAL_PRODUCTS) {
      if (!byId.has(String(d.id))) byId.set(String(d.id), d);
    }
    // Prefer override data but keep default packs if override has empty packs
    list = [...byId.values()].map((g) => {
      const def = DEFAULT_LOCAL_PRODUCTS.find((x) => String(x.id) === String(g.id));
      if (def && (!Array.isArray(g.packs) || !g.packs.length) && def.packs?.length) {
        return { ...def, ...g, packs: def.packs };
      }
      // Replace obsolete TikTok pack list (older defaults) with current promo packages
      if (String(g.id) === "tiktok-khmer" && def?.packs?.length) {
        const ids = (Array.isArray(g.packs) ? g.packs : []).map((x) => String(x.id || ""));
        const stale = !ids.length || ids.some((id) => /ttk-100-like|ttk-5k-10k|ttk-view-|ttk-follow-500|ttk-500-1k|ttk-1k-2k|ttk-2k-5k/.test(id));
        if (stale) return { ...def, ...g, packs: def.packs, famous: true, hot: true, open: g.open !== false };
      }
      return g;
    });
  } else {
    list = DEFAULT_LOCAL_PRODUCTS;
  }
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
        showWhenOff: !!g.showWhenOff,
        hue: Number(g.hue) || 210,
        mark: String(g.mark || "GC"),
        image: cleanImgUrl(g.image) || forcedImage(g) || defaultProductImage(g.id, g.name) || defaultById(g.id) || "",
        banners: cleanBanners(g.banners, g.banner),
        banner: cleanBanners(g.banners, g.banner)[0] || "",
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
        safetyGuide: (() => {
          const sg = g.safetyGuide && typeof g.safetyGuide === "object" ? g.safetyGuide : {};
          const enabled =
            sg.enabled === true ||
            sg.enabled === "true" ||
            (sg.enabled !== false &&
              sg.enabled !== "false" &&
              (dt === "robux_send" || String(g.id || "").includes("robux")));
          const stepsKm = Array.isArray(sg.stepsKm)
            ? sg.stepsKm.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 6)
            : String(sg.bodyKm || "")
                .split(/\n+/)
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 6);
          const stepsEn = Array.isArray(sg.stepsEn)
            ? sg.stepsEn.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 6)
            : String(sg.bodyEn || "")
                .split(/\n+/)
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 6);
          return {
            enabled,
            titleKm: String(sg.titleKm || "សូមអានមុនបន្ត").slice(0, 80),
            titleEn: String(sg.titleEn || "Please read before continuing").slice(0, 80),
            stepsKm,
            stepsEn,
          };
        })(),
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
              category: normCategory(p.category),
              bonus: p.bonus ? String(p.bonus) : "",
              image: String(p.image || ""),
              stock: dt === "stock" ? left : null,
              inStock: (dt === "live_chat" || dt === "robux_send") ? true : left > 0,
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
  return dt === "stock" || dt === "live_chat" || dt === "robux_send" || dt === "gift_code" || String(game.id || "").startsWith("roblox") || String(game.id || "").startsWith("robux");
}
