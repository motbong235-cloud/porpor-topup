import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import {
  UPLOAD_DIR,
  createOrder,
  createSession,
  deleteOrder,
  destroySession,
  getOrder,
  getSettings,
  listOrders,
  stats,
  updateOrder,
  updateSettings,
  validSession,
  getGiftStock,
  stockSummary,
  setPackStock,
  addPackStock,
  popPackStock,
  stockCount,
  runAutoBackup,
  listBackups,
  exportFullBackup,
  importFullBackup,
  SHOP_HOURS,
} from "./store.js";
import * as khmerSystem from "./khmerSystem.js";
import * as rielPay from "./rielPay.js";
import * as khmerSystemPay from "./khmerSystemPay.js";
import * as liveChat from "./liveChat.js";
import * as khmerTopup from "./khmerTopup.js";
import * as dinoTopup from "./dinoTopup.js";
import * as priceWatch from "./priceWatch.js";
import * as robloxLookup from "./robloxLookup.js";
import * as robloxPayout from "./robloxPayout.js";
import * as tiktokLookup from "./tiktokLookup.js";
import * as catalog from "./catalog.js";
import { isGiftCodeProduct, localCatalog, DEFAULT_LOCAL_PRODUCTS, cleanBanners } from "./localProducts.js";
import {
  clientIp,
  clientUa,
  limit,
  globalApiShield,
  softBotGate,
  securityHeaders,
  checkLoginAllowed,
  recordLoginFail,
  clearLoginFails,
  assertPaymentProviderPaid,
  auditLog,
  readAuditLog,
} from "./security.js";
import { issueCsrf, csrfGuard } from "./csrf.js";
import * as branding from "./branding.js";
import * as tg from "./telegramNotify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_ADMIN_PASSWORD = "porpor-admin-2026"; // public in the repo — never accepted in production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

/** Constant-time string compare (hash both sides so lengths never leak). */
function safeEq(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function isWeakAdminPassword(pw) {
  const p = String(pw || "");
  if (p.length < 12) return true;
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return true;
  if (/^porpor-admin-2026$/i.test(p)) return true;
  return false;
}
/** Private admin SPA path (no leading slash). Default: pp-console — set ADMIN_PATH on Render to hide it. */
const ADMIN_PATH = String(process.env.ADMIN_PATH || "pp-console").replace(/^\/+|\/+$/g, "") || "pp-console";
const isProd = process.env.NODE_ENV === "production";
if (isProd && (!process.env.ADMIN_PASSWORD || String(process.env.ADMIN_PASSWORD).trim() === DEFAULT_ADMIN_PASSWORD)) {
  console.error("[security] FATAL: ADMIN_PASSWORD is not set (or is the public default). Set a strong ADMIN_PASSWORD in Render → Environment, then redeploy.");
  process.exit(1);
}

/** Checkout idempotency: key -> { orderId, at } (in-memory, ~15 min) */
const checkoutIdem = new Map();
setInterval(() => {
  const cut = Date.now() - 15 * 60_000;
  for (const [k, v] of checkoutIdem) if (!v || v.at < cut) checkoutIdem.delete(k);
}, 60_000).unref?.();

const app = express();
// Number of proxy hops in front of the app: Render = 1 (default). Behind Cloudflare + Render set TRUST_PROXY=2.
const TRUST_PROXY = Number.isInteger(Number(process.env.TRUST_PROXY)) && process.env.TRUST_PROXY !== "" ? Number(process.env.TRUST_PROXY) : 1;
app.set("trust proxy", TRUST_PROXY);
// Edge hardening (before body parse for probes)
app.use(securityHeaders(isProd));
app.use(softBotGate);
app.use(
  express.json({
    limit: "1mb",
    // keep the exact bytes of webhook bodies so HMAC signatures can be verified
    verify: (req, _res, buf) => {
      if (String(req.url || "").startsWith("/api/webhook/")) req.rawBody = buf.toString("utf8");
    },
  }),
);
app.use(cookieParser());
app.use(csrfGuard);
// DDoS / flood shields (per-IP, in-memory — pair with Cloudflare)
app.use("/api/", globalApiShield({ perMin: 100, burst: 20, burstMs: 5_000 }));
app.use("/api/", limit("api", { limit: 90, windowMs: 60_000 }));


function adminAuth(req, res, next) {
  const token = req.cookies?.porpor_admin || req.headers["x-admin-token"];
  if (!validSession(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function newCode() {
  // Format: PORPOR + 10 hex (e.g. PORPOR2A1CF23C37) — no hyphen
  return `PORPOR${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function uniqueCode() {
  let id = newCode();
  while (getOrder(id)) id = newCode();
  return id;
}

const round2 = (n) => Math.round(n * 100) / 100;

function calcCoupon(settings, code, subtotal) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return { ok: true, discount: 0, code: "" };
  const found = (settings.coupons || []).find((x) => String(x.code).toUpperCase() === c);
  if (!found) return { ok: false, error: "coupon_invalid" };
  if (subtotal < (Number(found.min) || 0)) return { ok: false, error: "coupon_min" };
  const raw = found.type === "fixed" ? Number(found.value) || 0 : (subtotal * (Number(found.value) || 0)) / 100;
  return { ok: true, discount: Math.min(subtotal, round2(raw)), code: c };
}

function publicOrder(o) {
  if (!o) return o;
  return {
    id: o.id,
    gameId: o.gameId,
    gameName: o.gameName,
    packName: o.packName,
    qty: o.qty,
    total: o.total,
    discount: o.discount,
    userId: o.userId,
    zoneId: o.zoneId,
    server: o.server,
    nickname: o.nickname,
    method: o.method,
    status: o.status,
    createdAt: o.createdAt,
    paidAt: o.paidAt || null,
    providerPaid: !!o.providerPaid,
    needsManual: !!o.needsManual,
    deliveryType: o.deliveryType || "topup",
    giftCode: o.giftCode || null,
    note: o.note || "",
    telegramId: o.telegramId || null,
  };
}

function summarizeKt(codes, statuses) {
  const vals = codes.map((c) => String(statuses[c] || "").toLowerCase());
  if (vals.length && vals.every((v) => v === "completed")) return { status: "delivered" };
  if (vals.some((v) => v === "refunded")) return { status: "failed", note: "Supplier refunded" };
  return { status: "processing" };
}

/* ---------- Auto-deliver paid stock orders that were waiting for stock ---------- */
let restockBusy = false;

function isAwaitingStock(o) {
  if (!o || o.status !== "paid") return false;
  const dt = o.deliveryType || "";
  if (dt !== "stock" && dt !== "gift_code") return false;
  return !!o.awaitingStock || /^(No stock|Partial stock)/.test(String(o.note || ""));
}

/**
 * Deliver waiting orders (oldest first) as soon as the pack has enough codes.
 * packId = only that pack (after admin adds stock); omit = sweep every pack.
 * Returns how many orders were delivered.
 */
function fulfillAwaitingStock(packId) {
  if (restockBusy) return 0;
  restockBusy = true;
  let delivered = 0;
  try {
    const want = packId == null ? null : String(packId);
    const queue = listOrders()
      .filter((o) => isAwaitingStock(o) && (want === null || String(o.packId) === want))
      .sort((a, b) => (Number(a.paidAt || a.createdAt) || 0) - (Number(b.paidAt || b.createdAt) || 0));
    const blocked = new Set(); // keep first-paid-first-served per pack
    for (const o of queue) {
      const pid = String(o.packId);
      if (blocked.has(pid)) continue;
      const qty = Math.max(1, Math.min(10, Number(o.qty) || 1));
      const have = String(o.giftCode || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const need = qty - have.length;
      if (need > 0 && stockCount(pid) < need) {
        blocked.add(pid);
        continue;
      }
      const codes = have.slice();
      for (let i = 0; i < need; i++) {
        const c = popPackStock(pid);
        if (!c) break;
        codes.push(c);
      }
      if (codes.length < qty) {
        // should not happen (checked above) — keep what we got, stay in queue
        updateOrder(o.id, { giftCode: codes.join("\n"), awaitingStock: true });
        blocked.add(pid);
        continue;
      }
      const updated = updateOrder(o.id, {
        status: "delivered",
        giftCode: codes.join("\n"),
        awaitingStock: false,
        note: "Auto-delivered after restock",
        deliveredAt: Date.now(),
      });
      delivered++;
      try {
        tg.notifyOrder("delivered", updated).catch(() => {});
      } catch {}
      console.log(`[restock] auto-delivered order ${o.id} (${pid} x${qty})`);
    }
  } catch (e) {
    console.error("[restock]", e.message);
  } finally {
    restockBusy = false;
  }
  return delivered;
}

async function fulfillTopup(order) {
  const dt = order.deliveryType || "topup";

  // Robux Send / Live Chat — queue for admin; try Robux group auto-payout when enabled
  if (dt === "live_chat" || dt === "robux_send") {
    const autoOn = dt === "robux_send" && robloxPayout.isRobuxAutoReady();
    const queued = updateOrder(order.id, {
      status: "queued",
      needsManual: true,
      note:
        dt === "robux_send"
          ? (autoOn
              ? "Robux Send — auto group payout pending…"
              : "Robux Send — MANUAL (auto off or not configured). Admin transfer via Live Chat / bot.")
          : "Live Chat / manual delivery — notify bot",
      paidAt: order.paidAt || Date.now(),
      queuedAt: Date.now(),
    });
    try {
      if (dt === "robux_send") {
        (async () => {
          let o = queued;
          try {
            const prof = await robloxLookup.lookupRobloxUsername(o.userId);
            if (prof && prof.valid) {
              o = updateOrder(o.id, {
                rbxUsername: prof.username || o.userId,
                rbxDisplayName: prof.displayName || o.nickname || "",
                rbxUserId: prof.userId != null ? String(prof.userId) : o.rbxUserId,
                rbxAvatarUrl: prof.avatarUrl || o.rbxAvatarUrl,
                rbxProfileUrl: prof.profileUrl || o.rbxProfileUrl,
                nickname: prof.displayName || o.nickname || "",
              }) || o;
            }
          } catch (e) {
            console.warn("[robux] profile enrich failed", e.message);
          }
          await tg.notifyRobuxSend(o).catch(() => {});
          if (robloxPayout.isRobuxAutoReady()) {
            try {
              const r = await robloxPayout.tryAutoRobuxSend(o);
              if (r && r.ok) {
                const done = updateOrder(o.id, {
                  status: "delivered",
                  needsManual: false,
                  note: "Auto group payout OK",
                  deliveredAt: Date.now(),
                });
                tg.notifyOrder("delivered", done || getOrder(o.id)).catch(() => {});
                console.log("[robux-auto] delivered", o.id);
              } else {
                console.warn("[robux-auto]", o.id, r && r.error, r && r.detail);
                updateOrder(o.id, {
                  note: `Robux auto failed: ${(r && r.error) || "unknown"} — manual required`,
                });
              }
            } catch (e) {
              console.warn("[robux-auto]", e.message);
              updateOrder(o.id, { note: `Robux auto error: ${e.message}` });
            }
          }
        })().catch(() => {});
      } else if (dt === "live_chat" && tg.isKaiRouteOrder(queued)) {
        tg.notifyOrder("paid", queued)
          .then((r) => {
            if (!r || !r.ok) console.warn("[telegram] Kai live_chat paid notify", queued.id, r);
            else console.log("[telegram] Kai live_chat paid notify OK", queued.id);
          })
          .catch((e) => console.warn("[telegram] Kai live_chat notify err", e.message));
      } else if (dt === "live_chat" && !tg.isKaiRouteOrder(queued)) {
        tg.notifyChannel(tg.formatRobuxSendMsg(queued)).catch(() => {});
      }
    } catch {}
    return queued;
  }

  // Stock / gift_code — auto-assign code from inventory
  if (dt === "gift_code" || dt === "stock") {
    const codes = [];
    const qty = Math.max(1, Math.min(10, Number(order.qty) || 1));
    for (let i = 0; i < qty; i++) {
      const c = popPackStock(order.packId);
      if (!c) break;
      codes.push(c);
    }
    if (codes.length >= qty) {
      return updateOrder(order.id, {
        status: "delivered",
        giftCode: codes.join("\n"),
        note: "Auto-delivered from stock",
        deliveredAt: Date.now(),
        paidAt: order.paidAt || Date.now(),
      });
    }
    if (codes.length) {
      return updateOrder(order.id, {
        status: "paid",
        giftCode: codes.join("\n"),
        note: `Partial stock (${codes.length}/${qty}) — rest will auto-deliver when restocked`,
        awaitingStock: true,
        paidAt: order.paidAt || Date.now(),
      });
    }
    return updateOrder(order.id, {
      status: "paid",
      note: "No stock — will auto-deliver when restocked",
      awaitingStock: true,
      paidAt: order.paidAt || Date.now(),
    });
  }
  const settings = getSettings();
  if (!settings.autoTopup) {
    return updateOrder(order.id, { status: "paid", note: "autoTopup disabled — fulfill manually" });
  }

  // Provider: "khmer" | "dino" | "both"
  const pref = String(settings.topupProvider || order.topupProvider || "khmer").toLowerCase();
  let useDino = false;
  let useKhmer = false;
  if (pref === "dino") {
    useDino = dinoTopup.isDinoReady();
  } else if (pref === "both") {
    const dinoSel = settings.dinoSelection?.games || {};
    const slug = String(order.gameId || order.dinoGame || "");
    const dinoEnabled = !!(dinoSel[slug]?.enabled || dinoSel[order.dinoGame]?.enabled);
    const forceDino = order.topupProvider === "dino" || dinoEnabled;
    if (forceDino && dinoTopup.isDinoReady()) useDino = true;
    else if (khmerTopup.isTopupReady()) useKhmer = true;
    else if (dinoTopup.isDinoReady()) useDino = true;
  } else {
    useKhmer = khmerTopup.isTopupReady();
  }

  // Never auto-API for manual delivery types
  if (order.deliveryType === "robux_send" || order.deliveryType === "live_chat") {
    return updateOrder(order.id, {
      status: "queued",
      needsManual: true,
      note: order.deliveryType === "robux_send"
        ? "Robux Send — MANUAL only (blocked auto topup path)"
        : "Live Chat — manual only",
      paidAt: order.paidAt || Date.now(),
    });
  }

  if (useDino) {
    const product = order.dinoProduct || order.packId;
    const game = order.dinoGame || order.gameId;
    if (!product || !game) {
      return updateOrder(order.id, {
        status: "paid",
        note: "Dino product/game missing on order — fulfill manually",
      });
    }
    updateOrder(order.id, { status: "processing", topupProvider: "dino" });
    try {
      const result = await dinoTopup.placeOrder({
        game,
        product,
        playerId: order.userId,
        zoneId: order.zoneId || undefined,
        quantity: order.qty > 1 ? order.qty : undefined,
        reference: order.id,
        // supplier max = cost (not customer sell price)
        maxPrice: (Number(order.cost) > 0 ? Number(order.cost) * (Number(order.qty) || 1) : undefined),
      });
      const remote = result.order || result;
      const st = dinoTopup.summarizeDinoStatus(remote.status);
      return updateOrder(order.id, {
        status: st.done ? (st.status === "failed" ? "paid" : st.status === "done" ? "done" : st.status) : "processing",
        paidAt: order.paidAt || Date.now(),
        providerPaid: true,
        topupProvider: "dino",
        dinoOrderId: remote.order_id || remote.id || null,
        dinoReference: remote.reference || order.id,
        dinoStatus: remote.status || null,
        note: `Dino ${remote.order_id || remote.reference || ""} · ${remote.status || ""}`,
        needsManual: st.status === "failed",
      });
    } catch (e) {
      return updateOrder(order.id, {
        status: "paid",
        paidAt: order.paidAt || Date.now(),
        providerPaid: true,
        topupProvider: "dino",
        note: `Dino topup error: ${e.message} — fulfill manually`,
        needsManual: true,
      });
    }
  }

  if (!useKhmer) {
    return updateOrder(order.id, {
      status: "paid",
      note: "No topup provider ready (set DINO_TOPUP_API_KEY or KHMER_TOPUP_API_KEY)",
    });
  }
  if (!order.ktPackageId) {
    return updateOrder(order.id, {
      status: "paid",
      note: "Missing Khmer TopUp package id on this order — fulfill manually",
    });
  }

  const codes = [...(order.ktOrderCodes || (order.ktOrderCode ? [order.ktOrderCode] : []))];
  const statuses = { ...(order.ktStatuses || {}) };
  updateOrder(order.id, { status: "processing", topupProvider: "khmer" });

  try {
    for (let i = codes.length; i < (order.qty || 1); i++) {
      const result = await khmerTopup.placeOrder({
        packageId: order.ktPackageId,
        playerId: order.userId,
        serverId: order.zoneId || order.server || undefined,
        reference: order.qty > 1 ? `${order.id}-${i + 1}` : order.id,
      });
      codes.push(result.order_code);
      statuses[result.order_code] = result.status;
      updateOrder(order.id, { ktOrderCodes: codes, ktOrderCode: codes[0], ktStatuses: statuses });
    }
  } catch (e) {
    return updateOrder(order.id, {
      status: "paid",
      paidAt: order.paidAt || Date.now(),
      providerPaid: true,
      ktOrderCodes: codes,
      ktOrderCode: codes[0] || order.ktOrderCode,
      ktStatuses: statuses,
      note: `TopUp error after ${codes.length}/${order.qty || 1}: ${e.message} — fulfill manually`,
      needsManual: true,
    });
  }

  return updateOrder(order.id, {
    ...summarizeKt(codes, statuses),
    note: `Khmer TopUp ${codes.join(", ")}`,
  });
}

async function pollKtStatus(order) {
  const codes = order.ktOrderCodes || (order.ktOrderCode ? [order.ktOrderCode] : []);
  if (!codes.length || !khmerTopup.isTopupReady()) return order;
  const statuses = { ...(order.ktStatuses || {}) };
  try {
    for (const code of codes) {
      if (String(statuses[code] || "").toLowerCase() === "completed") continue;
      const remote = await khmerTopup.getOrder(code);
      statuses[code] = String(remote.status || "").toLowerCase();
    }
    return updateOrder(order.id, { ktStatuses: statuses, ...summarizeKt(codes, statuses) });
  } catch {
    return order;
  }
}


app.get("/api/csrf", (req, res) => {
  const csrf = issueCsrf(res, isProd);
  res.json({ csrf });
});

app.get("/api/public-config", (_req, res) => {
  // Do not expose ADMIN_PATH here (security). Path is injected into index.html as window.__ADMIN_PATH__ only.
  res.json({ ok: true });
});


app.get("/api/ticker", (_req, res) => {
  // Everything here comes from real orders in the database — nothing is made up.
  res.set("Cache-Control", "public, max-age=10");
  try {
    const settings = getSettings();
    const all = listOrders();
    const okStatus = new Set([
      "paid", "delivered", "done", "success", "completed", "processing", "fulfilled",
    ]);
    const stamp = (o) => Number(o.paidAt || o.deliveredAt || o.createdAt) || 0;
    const real = all
      .filter((o) => okStatus.has(String(o.status || "").toLowerCase()))
      .sort((a, b) => stamp(b) - stamp(a));

    const items = real.slice(0, 30).map((o) => {
      const game = String(o.gameName || o.productName || o.serviceName || "").trim();
      const pack = String(o.packName || o.packageName || o.title || "").trim();
      const qty = Number(o.qty) > 1 ? ` ×${o.qty}` : "";
      let label = "";
      if (game && pack) label = `${game} — ${pack}${qty}`;
      else if (pack) label = `${pack}${qty}`;
      else if (game) label = `${game}${qty}`;
      else label = `Order ${String(o.id || "").slice(-6)}`;
      return {
        id: String(o.id || "").slice(-8),
        label: label.slice(0, 56),
        at: stamp(o),
      };
    });

    // Real average delivery time (payment → delivered), from the latest delivered orders
    const spans = real
      .filter((o) => o.deliveredAt && o.paidAt)
      .slice(0, 100)
      .map((o) => (Number(o.deliveredAt) - Number(o.paidAt)) / 1000)
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 6 * 3600);
    const avgDeliverySec = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null;

    // Real sold count (a starting number is only added if the admin set one on purpose)
    const realCount = real.length;
    const base = Number(settings.tickerSoldBase);
    const sold = Number.isFinite(base) && base > 0 ? base + realCount : realCount;
    const soldLabel =
      (settings.tickerSoldLabel && String(settings.tickerSoldLabel).trim()) ||
      (sold > 0 ? `ការបញ្ជាទិញ — ${sold} បានលក់` : "ការបញ្ជាទិញ");

    res.json({
      ok: true,
      delivery: SHOP_HOURS,
      soldLabel,
      sold,
      avgDeliverySec,
      items, // real only — empty if no paid orders yet
    });
  } catch (e) {
    console.error("[ticker]", e);
    res.json({ ok: true, delivery: SHOP_HOURS, soldLabel: "ការបញ្ជាទិញ", sold: 0, avgDeliverySec: null, items: [] });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "POR POR TOPUP",
    payment: khmerSystem.isPaymentReady() || rielPay.isReady(),
    topup: khmerTopup.isTopupReady() || dinoTopup.isDinoReady(),
    dinoTopup: dinoTopup.isDinoReady(),
  });
});

app.get("/api/integrations/status", (_req, res) => {
  const s = getSettings();
  res.json({
    paymentReady: khmerSystem.isPaymentReady() || rielPay.isReady(),
    rielpayReady: rielPay.isReady(),
    topupReady: khmerTopup.isTopupReady() || dinoTopup.isDinoReady(),
    khmerTopupReady: khmerTopup.isTopupReady(),
    dinoTopupReady: dinoTopup.isDinoReady(),
    topupProvider: s.topupProvider || "khmer",
    autoTopup: !!s.autoTopup,
  });
});

app.get("/api/settings", (_req, res) => {
  const s = getSettings();
  res.json({
    siteName: s.siteName,
    taglineKm: s.taglineKm,
    taglineEn: s.taglineEn,
    telegram: s.telegram,
    announcementKm: s.announcementKm,
    announcementEn: s.announcementEn,
    maintenance: s.maintenance,
    logoUrl: s.logoUrl || "",
    bannerUrls: Array.isArray(s.bannerUrls) ? s.bannerUrls : [],
    // Never list coupon codes publicly — validate only at checkout when user types a code
    couponsEnabled: Array.isArray(s.coupons) && s.coupons.length > 0,
  });
});

/** Preview coupon discount — does not list codes; user must already know the code */
app.post("/api/coupon/preview", limit("coupon", { limit: 30, windowMs: 60_000 }), (req, res) => {
  const code = String(req.body?.code || "").trim();
  const subtotal = Number(req.body?.subtotal) || 0;
  if (!code) return res.json({ ok: true, discount: 0, code: "" });
  if (subtotal < 0 || subtotal > 1e6) return res.status(400).json({ ok: false, error: "bad_subtotal" });
  const cp = calcCoupon(getSettings(), code, subtotal);
  if (!cp.ok) return res.json({ ok: false, error: cp.error === "coupon_min" ? "min" : "bad", discount: 0 });
  res.json({ ok: true, discount: cp.discount, code: cp.code });
});

/** Which server build is live (to confirm a deploy actually took effect). */

/* ---------- In-site Live Chat ---------- */

/* ---------- Live Chat media (image + voice) — rate-limited by IP via body size ---------- */
function sniffChatMedia(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  // webm
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  // ogg
  if (b.toString("ascii", 0, 4) === "OggS") return "ogg";
  // mp4 / m4a
  if (b.toString("ascii", 4, 8) === "ftyp") return "m4a";
  return null;
}

/* Visitor uploads are capped (per IP per day + total disk) and old files are deleted automatically */
const CHAT_UPLOAD_MAX_BYTES = 300 * 1024 * 1024;
const CHAT_UPLOAD_TTL_MS = 45 * 24 * 3600 * 1000;

function chatUploadUsage() {
  let total = 0;
  try {
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (!f.startsWith("chat-")) continue;
      try {
        total += fs.statSync(path.join(UPLOAD_DIR, f)).size;
      } catch {}
    }
  } catch {}
  return total;
}

function pruneChatUploads() {
  try {
    const cut = Date.now() - CHAT_UPLOAD_TTL_MS;
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (!f.startsWith("chat-")) continue;
      const fp = path.join(UPLOAD_DIR, f);
      try {
        if (fs.statSync(fp).mtimeMs < cut) fs.unlinkSync(fp);
      } catch {}
    }
  } catch {}
}
setInterval(pruneChatUploads, 6 * 3600 * 1000).unref?.();
setTimeout(pruneChatUploads, 30 * 1000).unref?.();

app.post(
  "/api/chat/upload",
  limit("chat_upload", { limit: 8, windowMs: 60_000 }),
  limit("chat_upload_day", { limit: 40, windowMs: 24 * 3600 * 1000 }),
  express.raw({ type: () => true, limit: "3mb" }),
  (req, res) => {
  if (chatUploadUsage() > CHAT_UPLOAD_MAX_BYTES) return res.status(507).json({ error: "storage_full" });
  const ext = sniffChatMedia(req.body);
  if (!ext) return res.status(400).json({ error: "bad_file" });
  // images + audio only
  const ok = ["png", "jpg", "gif", "webp", "webm", "ogg", "m4a"].includes(ext);
  if (!ok) return res.status(400).json({ error: "bad_file" });
  if (!req.body || req.body.length < 64) return res.status(400).json({ error: "empty" });
  const name = `chat-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  } catch (e) {
    return res.status(500).json({ error: "write_failed" });
  }
  res.json({ url: `/uploads/${name}`, type: ["webm", "ogg", "m4a"].includes(ext) ? "voice" : "image" });
});

/** Visitor chat identity = random cookie token (never the IP: CGNAT shares IPs, XFF can be forged). */
function chatToken(req, res) {
  const cur = String(req.cookies?.porpor_chat || "");
  if (/^[a-f0-9]{32}$/.test(cur)) return cur;
  const tok = crypto.randomBytes(16).toString("hex");
  res.cookie("porpor_chat", tok, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 365 * 24 * 3600 * 1000,
    path: "/",
  });
  return tok;
}

app.post("/api/chat/session", limit("chat_session", { limit: 30, windowMs: 60_000 }), (req, res) => {
  const meta = {
    name: String(req.body?.name || "").slice(0, 80),
    orderId: String(req.body?.orderId || "").slice(0, 40),
    ip: clientIp(req),
  };
  const thread = liveChat.getOrCreateThread(chatToken(req, res), meta);
  res.json({ visitorId: thread.id, messages: thread.messages || [] });
});

app.get("/api/chat/messages", (req, res) => {
  // Always bind to the visitor's own cookie token (ignore any client-supplied thread id)
  const tid = chatToken(req, res);
  const after = Number(req.query.after || 0) || 0;
  const data = liveChat.getMessages(tid, after);
  if (!data) return res.status(404).json({ error: "not_found" });
  liveChat.markRead(tid, "user");
  res.json(data);
});

app.post("/api/chat/messages", limit("chat_msg", { limit: 20, windowMs: 60_000 }), (req, res) => {
  const tid = chatToken(req, res);
  const type = String(req.body?.type || "text");
  const text = String(req.body?.text || "").trim();
  const mediaUrl = String(req.body?.mediaUrl || "").trim();
  const duration = Number(req.body?.duration) || 0;
  if (type === "text") {
    if (!text) return res.status(400).json({ error: "invalid" });
    if (text.length > 2000) return res.status(400).json({ error: "too_long" });
  } else if (type === "image" || type === "voice") {
    if (!/^\/uploads\/chat-[\w.-]{1,120}$/.test(mediaUrl) || mediaUrl.includes("..")) {
      return res.status(400).json({ error: "bad_media" });
    }
  } else {
    return res.status(400).json({ error: "bad_type" });
  }
  const msg = liveChat.postUserMessage(
    tid,
    { type, text, mediaUrl, duration },
    { name: req.body?.name, orderId: req.body?.orderId, ip: clientIp(req) },
  );
  if (!msg) return res.status(400).json({ error: "invalid" });
  res.json({ ok: true, message: msg });
});

app.get("/api/admin/chat/threads", adminAuth, (_req, res) => {
  res.json({ threads: liveChat.listThreads() });
});

app.get("/api/admin/chat/:id", adminAuth, (req, res) => {
  const data = liveChat.getMessages(req.params.id, 0);
  if (!data) return res.status(404).json({ error: "not_found" });
  liveChat.markRead(req.params.id, "admin");
  res.json(data);
});

app.post("/api/admin/chat/:id", adminAuth, (req, res) => {
  const type = String(req.body?.type || "text");
  const text = String(req.body?.text || "").trim();
  const mediaUrl = String(req.body?.mediaUrl || req.body?.url || "").trim();
  const duration = Number(req.body?.duration) || 0;
  if (type === "text" && !text) return res.status(400).json({ error: "empty" });
  if ((type === "image" || type === "voice") && !/^\/uploads\/[\w.-]{1,120}$/.test(mediaUrl)) {
    return res.status(400).json({ error: "bad_media" });
  }
  const msg = liveChat.postAgentMessage(req.params.id, { type, text, mediaUrl, duration });
  if (!msg) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true, message: msg });
});


app.get("/api/version", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    build: "v2.0.0",
    usernameRequiredIds: String(process.env.USERNAME_REQUIRED_IDS || ""),
  });
});

/** Games + packages the admin selected from Khmer TopUp (prices include markup). */
app.get("/api/catalog", async (req, res) => {
  try {
    const settings = getSettings();
    const t0 = Date.now();
    let games = await catalog.publicCatalog();
    const tgUser = tg.readTgSession(req.cookies?.porpor_tg);
    const applied = catalog.applyResellerToCatalog(games, settings, tgUser);
    // Short browser/CDN cache — catalog changes are admin-side, 15s is fine
    res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    res.setHeader("X-Catalog-Ms", String(Date.now() - t0));
    res.json({
      games: applied.games,
      isReseller: applied.isReseller,
      resellerUsername: applied.isReseller ? (tgUser?.username || tgUser?.id || null) : null,
    });
  } catch (e) {
    res.status(502).json({ games: [], error: "catalog_unavailable", message: e.message });
  }
});

app.post("/api/verify", limit("verify", { limit: 15, windowMs: 60_000 }), async (req, res) => {
  const { slug, playerId, serverId } = req.body || {};
  if (!slug || !playerId) return res.status(400).json({ result: "incomplete", message: "slug and playerId required" });
  try {
    let game = await catalog.findGame(slug);
    if (!game) return res.status(404).json({ result: "unknown", error: "game_unavailable" });
    // Closed local product may still be sold via Dino/Khmer on Home — allow Check ID
    if (game.open === false) {
      const slugL0 = String(game.id || slug).toLowerCase();
      const nameL0 = String(game.name || "").toLowerCase();
      const looksRbx =
        game.deliveryType === "robux_send" ||
        slugL0.includes("roblox") ||
        slugL0.includes("robux") ||
        slugL0.includes("rbx") ||
        nameL0.includes("roblox") ||
        nameL0.includes("robux");
      if (!looksRbx) {
        return res.status(404).json({ result: "unknown", error: "game_unavailable" });
      }
      // treat as open for verification only
      game = { ...game, open: true };
    }

    const slugL = String(game.id || slug).toLowerCase();
    const nameL = String(game.name || "").toLowerCase();
    const isTikTok =
      slugL.includes("tiktok") ||
      nameL.includes("tiktok") ||
      String(game.nameKm || "").toLowerCase().includes("tiktok");
    const isRoblox =
      game.deliveryType === "robux_send" ||
      (game.provider === "dino" && (slugL.includes("roblox") || slugL.includes("robux") || slugL.includes("rbx"))) ||
      slugL.includes("roblox") ||
      slugL.includes("robux") ||
      slugL.includes("rbx") ||
      nameL.includes("roblox") ||
      nameL.includes("robux") ||
      nameL.includes("rbx");

    // TikTok Khmer: resolve video URL → @username (oEmbed + redirect)
    if (isTikTok) {
      try {
        const tt = await tiktokLookup.lookupTikTokLink(playerId);
        if (!tt || !tt.valid) {
          return res.json({
            result: "invalid",
            valid: false,
            message: "Invalid TikTok link — use full video URL",
            provider: "tiktok",
          });
        }
        if (!tt.username && !tt.displayName) {
          return res.json({
            result: "invalid",
            valid: false,
            message: "Could not read TikTok username from link",
            provider: "tiktok",
            tiktok: tt,
          });
        }
        return res.json({
          result: "valid",
          valid: true,
          nickname: tt.displayName || tt.username,
          provider: "tiktok",
          tiktok: {
            username: tt.username,
            displayName: tt.displayName,
            authorUrl: tt.authorUrl,
            thumbnail: tt.thumbnail,
            avatarUrl: tt.avatarUrl || null,
            title: tt.title,
            resolvedUrl: tt.resolvedUrl || tt.inputUrl,
            inputUrl: tt.inputUrl,
          },
        });
      } catch (e) {
        return res.json({ result: "unknown", error: e.message, provider: "tiktok" });
      }
    }

    // Roblox: always enrich with public profile (avatar + display name)
    let rbx = null;
    if (isRoblox) {
      try {
        rbx = await robloxLookup.lookupRobloxUsername(playerId);
      } catch (e) {
        rbx = { valid: false, message: e.message };
      }
    }

    const pref = String(getSettings().topupProvider || "khmer").toLowerCase();
    let supplier = null;
    try {
      if (dinoTopup.isDinoReady() && (pref === "dino" || isRoblox)) {
        // Prefer Dino check-id for roblox when key exists
        const gameKey = isRoblox ? "roblox" : game.dinoId || slug;
        try {
          const data = await dinoTopup.checkId(gameKey, playerId, serverId);
          supplier = {
            provider: "dino",
            valid: !!data.valid,
            nickname: data.nickname || null,
            region: data.region || null,
            message: data.message || null,
            unavailable: !!data.unavailable,
          };
        } catch (e) {
          if (pref === "dino" && !isRoblox) throw e;
          // roblox can continue with public lookup only
        }
      }
      if (!supplier && khmerTopup.isTopupReady() && !isRoblox) {
        const data = await khmerTopup.verifyAccount(slug, playerId, serverId);
        // normalize Khmer response
        const result = data.result || (data.valid ? "valid" : data.valid === false ? "invalid" : "unknown");
        return res.json({ ...data, result: result === "ok" ? "valid" : result });
      }
    } catch (e) {
      if (!isRoblox) return res.json({ result: "unknown", error: e.message });
    }

    if (isRoblox) {
      // Prefer public Roblox profile; if Roblox API blocked, accept Dino check-id when valid
      if (rbx?.valid) {
        return res.json({
          result: "valid",
          valid: true,
          nickname: supplier?.nickname || rbx.displayName || rbx.username,
          region: supplier?.region || null,
          message: supplier?.message || null,
          provider: supplier?.provider || "roblox",
          roblox: {
            userId: rbx.userId,
            username: rbx.username,
            displayName: rbx.displayName,
            verified: !!rbx.verified,
            created: rbx.created || null,
            about: rbx.about || "",
            avatarUrl: rbx.avatarUrl || null,
            friends: rbx.friends,
            followers: rbx.followers,
            followings: rbx.followings,
            profileUrl: rbx.profileUrl || null,
          },
        });
      }
      if (supplier && supplier.valid === true) {
        const uname = String(playerId || "").trim().replace(/^@/, "");
        return res.json({
          result: "valid",
          valid: true,
          nickname: supplier.nickname || uname,
          region: supplier.region || null,
          message: supplier.message || null,
          provider: supplier.provider || "dino",
          roblox: {
            userId: null,
            username: uname,
            displayName: supplier.nickname || uname,
            verified: false,
            created: null,
            about: "",
            avatarUrl: null,
            friends: null,
            followers: null,
            followings: null,
            profileUrl: uname ? `https://www.roblox.com/search/users?keyword=${encodeURIComponent(uname)}` : null,
          },
        });
      }
      if (rbx?.unavailable) {
        return res.json({
          result: "unknown",
          valid: false,
          message: rbx.message || "Roblox lookup unavailable",
          provider: "roblox",
        });
      }
      return res.json({
        result: "invalid",
        valid: false,
        message: rbx?.message || supplier?.message || "Invalid Roblox username",
        provider: supplier?.provider || "roblox",
      });
    }


    if (supplier) {
      return res.json({
        result: supplier.valid ? "valid" : "invalid",
        valid: supplier.valid,
        nickname: supplier.nickname,
        region: supplier.region,
        message: supplier.message,
        provider: supplier.provider,
      });
    }

    if (!khmerTopup.isTopupReady() && !dinoTopup.isDinoReady()) {
      return res.status(503).json({ result: "unknown", error: "topup_not_configured" });
    }
    return res.json({ result: "unknown", message: "no_check" });
  } catch (e) {
    return res.json({ result: "unknown", error: e.message });
  }
});


app.get("/api/auth/telegram/config", (_req, res) => {
  const botUsername = tg.botUsername() || null;
  const ready = tg.isLoginReady();
  res.set("Cache-Control", "no-store");
  res.json({
    ok: Boolean(botUsername),
    botUsername,
    configured: ready,
    hasToken: Boolean(typeof tg.botToken === "function" ? tg.botToken() : false),
  });
});
function setTgCookie(res, user) {
  const token = tg.signTgSession(user);
  res.cookie("porpor_tg", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
    path: "/",
  });
}

app.post("/api/auth/telegram", limit("tglogin", { limit: 20, windowMs: 60_000 }), (req, res) => {
  const v = tg.verifyTelegramLogin(req.body || {});
  if (!v.ok) {
    console.warn("[tg-login]", v.error, req.body?.id);
    return res.status(401).json({ error: v.error || "unauthorized" });
  }
  setTgCookie(res, v.user);
  auditLog("tg_login", { tgId: v.user.id, username: v.user.username, ip: clientIp(req) });
  res.json({ ok: true, user: v.user });
});

/** Redirect-based login (more reliable on mobile / when embed widget stays blank) */
app.get("/api/auth/telegram/callback", limit("tglogin", { limit: 30, windowMs: 60_000 }), (req, res) => {
  const v = tg.verifyTelegramLogin(req.query || {});
  if (!v.ok) {
    console.warn("[tg-login-callback]", v.error, req.query?.id);
    return res.redirect("/?tg_login=fail");
  }
  setTgCookie(res, v.user);
  auditLog("tg_login", { tgId: v.user.id, username: v.user.username, ip: clientIp(req), via: "callback" });
  res.redirect("/?tg_login=ok");
});
app.get("/api/auth/me", (req, res) => {
  const user = tg.readTgSession(req.cookies?.porpor_tg);
  if (!user) return res.json({ ok: false, user: null });
  res.json({ ok: true, user });
});
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("porpor_tg", { path: "/" });
  res.json({ ok: true });
});

app.post("/api/checkout/create", limit("checkout", { limit: 8, windowMs: 60_000 }), async (req, res, next) => {
  try {
  const body = req.body || {};
  const settings = getSettings();
  if (settings.maintenance) {
    return res.status(503).json({ error: "maintenance" });
  }
  if (!khmerSystem.isPaymentReady()) {
    return res.status(503).json({ error: "not_configured" });
  }
  if (!body.gameId || !body.packId) {
    return res.status(400).json({ error: "invalid" });
  }

  // Idempotency: same key within ~15 min returns the same still-pending order/QR
  const idemRaw = String(body.idempotencyKey || "").trim().slice(0, 160);
  if (idemRaw) {
    const hit = checkoutIdem.get(`${clientIp(req)}:${idemRaw}`);
    const prev = hit ? getOrder(hit.orderId) : null;
    if (prev && prev.status === "pending" && prev.qrImage) {
      return res.json({
        order: publicOrder(prev),
        payment: {
          transactionId: prev.transactionId,
          qrImage: prev.qrImage,
          qrString: prev.qrString,
          payUrl: prev.payUrl || "",
          deeplink: prev.openAbaUrl || prev.deeplink || prev.payUrl || "",
          openAbaUrl: prev.openAbaUrl || "",
          expiresAt: prev.expiresAt,
        },
      });
    }
  }

  // Price comes from the server catalog — never trust the client total.
  let found;
  try {
    found = await catalog.findPack(body.gameId, body.packId);
  } catch (e) {
    return res.status(502).json({ error: "catalog_unavailable" });
  }
  if (!found) return res.status(400).json({ error: "pack_unavailable" });
  // A game the admin turned OFF can never be ordered, even by calling the API directly
  if (found.game.open === false) return res.status(400).json({ error: "pack_unavailable" });

  const giftCode = isGiftCodeProduct(found.game);
  if (giftCode) {
    const dt = found.game.deliveryType || "stock";
    if (dt === "stock" || dt === "gift_code") {
      const need = Math.min(10, Math.max(1, Math.floor(Number(body.qty)) || 1));
      const left = stockCount(found.pack.id);
      if (left < need) {
        return res.status(400).json({ error: "out_of_stock", stock: left });
      }
    }
  }

  // Gift cards / local products do not need Khmer TopUp
  if (!giftCode && !khmerTopup.isTopupReady()) {
    return res.status(503).json({ error: "not_configured" });
  }

  const userId = String(body.userId || "").trim();
  const needUser = giftCode
    ? (typeof found.game.requireUsername === "boolean"
        ? found.game.requireUsername
        : found.game.deliveryType === "live_chat" || found.game.deliveryType === "robux_send" || found.game.deliveryType === "gift_code")
    : true;
  if (needUser && userId.length < 3) {
    return res.status(400).json({ error: "invalid", detail: "need_username" });
  }

  const zoneId = String(body.zoneId || "").trim();
  const server = String(body.server || "").trim();
  if (!giftCode && found.game.hasZone && !zoneId) return res.status(400).json({ error: "need_zone" });
  if (!giftCode && found.game.servers?.length && !found.game.servers.some((s) => s.value === server)) {
    return res.status(400).json({ error: "need_server" });
  }

  const qty = Math.min(10, Math.max(1, Math.floor(Number(body.qty)) || 1));
  // Reseller fixed price (USD) when logged-in TG user is in reseller list
  const tgUser = tg.readTgSession(req.cookies?.porpor_tg);
  const isRes = catalog.isResellerUser(settings, tgUser);
  const fixedRp = isRes ? catalog.resellerFixedPrice(settings, found.pack.id) : null;
  const unitPrice = fixedRp != null ? fixedRp : Number(found.pack.price);
  const unitCost = Number(found.pack.cost) || 0;
  const subtotal = round2(unitPrice * qty);
  const cp = calcCoupon(settings, body.coupon, subtotal);
  if (!cp.ok) return res.status(400).json({ error: cp.error });
  const total = round2(subtotal - cp.discount);
  if (!(total > 0)) return res.status(400).json({ error: "invalid" });

  let order = createOrder({
    id: uniqueCode(),
    gameId: found.game.id,
    gameName: found.game.name,
    packId: found.pack.id,
    packName: found.pack.name,
    qty,
    total,
    discount: cp.discount,
    cost: round2((found.pack.cost || found.pack.price) * qty),
    userId: giftCode ? (needUser ? userId : userId || "gift") : userId,
    zoneId,
    server,
    nickname: String(body.nickname || body.rbxDisplayName || ""),
    rbxUsername: String(body.rbxUsername || body.userId || "").trim().slice(0, 64) || null,
    rbxDisplayName: String(body.rbxDisplayName || body.nickname || "").trim().slice(0, 64) || null,
    rbxUserId: body.rbxUserId != null && body.rbxUserId !== "" ? String(body.rbxUserId).slice(0, 32) : null,
    rbxAvatarUrl: (() => {
      const u = String(body.rbxAvatarUrl || "").trim();
      if (/^https:\/\/[^\s"'<>]{1,500}$/.test(u)) return u;
      return null;
    })(),
    rbxProfileUrl: (() => {
      const u = String(body.rbxProfileUrl || "").trim();
      if (/^https:\/\/(www\.)?roblox\.com\/[^\s"'<>]{1,200}$/.test(u)) return u;
      return null;
    })(),
    method: "khqr",
    coupon: cp.code,
    ktPackageId: giftCode ? null : Number(found.pack.id) || null,
    dinoGame: giftCode ? null : (found.game.dinoId || found.game.id || null),
    dinoProduct: giftCode ? null : (found.pack.dinoId || found.pack.id || null),
    topupProvider: giftCode
      ? null
      : (found.game.provider === "dino" || String(settings.topupProvider || "").toLowerCase() === "dino"
          ? "dino"
          : String(settings.topupProvider || "").toLowerCase() === "both" && found.game.provider === "dino"
            ? "dino"
            : null),
    deliveryType: giftCode
      ? (found.game.deliveryType === "live_chat" || found.game.deliveryType === "robux_send" || found.game.deliveryType === "stock" || found.game.deliveryType === "gift_code"
          ? found.game.deliveryType
          : "stock")
      : (found.game.deliveryType === "robux_send"
          ? "robux_send"
          : found.game.deliveryType === "live_chat"
            ? "live_chat"
            : "topup"),
    giftCode: null,
    status: "pending",
    clientIp: clientIp(req),
    userAgent: clientUa(req),
    createdAt: Date.now(),
  });

  const kaiRoute = tg.isKaiRouteOrder({
    gameId: order.gameId,
    gameName: order.gameName,
    packName: order.packName,
  });
  // TikTok: resolve @username from video link (oEmbed + URL) so admin never mis-targets
  if (kaiRoute && order.userId) {
    try {
      const tt = await tiktokLookup.lookupTikTokLink(order.userId);
      if (tt && (tt.username || tt.displayName)) {
        order = updateOrder(order.id, {
          ttkUsername: tt.username || null,
          ttkDisplayName: tt.displayName || null,
          ttkAuthorUrl: tt.authorUrl || null,
          ttkThumbnail: tt.thumbnail || null,
          ttkAvatarUrl: tt.avatarUrl || null,
          ttkResolvedUrl: tt.resolvedUrl || null,
          ttkTitle: tt.title || null,
        }) || order;
      }
    } catch (e) {
      console.warn("[tiktok] lookup on checkout", e.message);
    }
  }

  // Payment gateway: settings.paymentGateway = "rielpay" | "khmer" (default)
  // Kai TikTok route always uses Khmer System / Kai ABA credentials
  const payGw = kaiRoute
    ? "khmer"
    : String((getSettings() || {}).paymentGateway || process.env.PAYMENT_GATEWAY || "khmer").toLowerCase();
  let qr;
  let usedGateway = "khmer";
  if (payGw === "rielpay" && rielPay.isReady()) {
    qr = await rielPay.createPayment(order.total, order.id, `${order.gameName || "Topup"} ${order.packName || ""}`.trim());
    usedGateway = "rielpay";
    if (!qr.success && khmerSystem.isPaymentReady()) {
      console.warn("[checkout] RielPay failed, fallback Khmer System:", qr.error);
      qr = await khmerSystem.createQr(order.total, order.id, `p${order.id}`, { useKai: false });
      usedGateway = "khmer";
    }
  } else {
    qr = await khmerSystem.createQr(order.total, order.id, `p${order.id}`, { useKai: kaiRoute });
    usedGateway = kaiRoute ? "khmer_kai" : "khmer";
  }
  if (!qr.success) {
    console.error("[checkout] QR failed:", usedGateway, qr.error, JSON.stringify(qr.raw || {}));
    updateOrder(order.id, { status: "failed", note: `QR error (${usedGateway}): ${qr.error}` });
    return res.status(502).json({ error: "qr_failed", detail: qr.error });
  }
  // QR lifetime: default / minimum 1 hour (3600s). Provider may return shorter —
  // we still expose at least 1h to the client countdown; actual bank QR may vary.
  const QR_EXPIRE_SEC = Math.max(3600, Number(process.env.QR_EXPIRE_SEC || 3600) || 3600);
  const minExpiryMs = Date.now() + QR_EXPIRE_SEC * 1000;
  let expiresAt =
    qr.expires_at ||
    qr.expire_at ||
    qr.expired_at ||
    new Date(minExpiryMs).toISOString();
  const expMs = Date.parse(expiresAt);
  if (!Number.isFinite(expMs) || expMs < minExpiryMs) {
    expiresAt = new Date(minExpiryMs).toISOString();
  }
  const openAba = qr.open_aba_url || "";
  const updated = updateOrder(order.id, {
    transactionId: qr.transaction_id,
    qrImage: qr.qr_image,
    qrString: qr.qr_string,
    payUrl: qr.pay_url || "",
    deeplink: qr.deeplink || qr.pay_url || "",
    openAbaUrl: openAba,
    expiresAt,
    payViaKai: !!kaiRoute,
    paymentGateway: usedGateway.startsWith("riel") ? "rielpay" : "khmer",
    method: usedGateway === "rielpay" ? "rielpay_khqr" : (kaiRoute ? "khqr_kai" : (order.method || "khqr")),
  });
  auditLog("checkout_create", { orderId: updated.id, total: updated.total, ip: clientIp(req) });
  try { tg.notifyOrder("new", updated).catch(() => {}); } catch {}
  if (idemRaw) {
    checkoutIdem.set(`${clientIp(req)}:${idemRaw}`, { orderId: updated.id, at: Date.now() });
  }
  return res.json({
    order: publicOrder(updated),
    payment: {
      transactionId: qr.transaction_id,
      qrImage: qr.qr_image,
      qrString: qr.qr_string,
      payUrl: qr.pay_url || "",
      deeplink: openAba || qr.deeplink || qr.pay_url || "",
      openAbaUrl: openAba,
      expiresAt,
    },
  });
  } catch (e) {
    console.error("[checkout] unexpected:", e && e.stack ? e.stack : e);
    if (!res.headersSent) res.status(500).json({ error: "server_error" });
  }
});


/** Confirm provider payment + fulfill. Safe if user closed the page (no client poll). */
const _payConfirmLock = new Set();

async function tryConfirmPayment(order, meta = {}) {
  if (!order || !order.id) return order;
  if (_payConfirmLock.has(order.id)) return order;
  const st0 = order.status;
  if (!(st0 === "pending" || (st0 === "failed" && !order.providerPaid))) return order;
  if (!order.transactionId || !khmerSystem.isPaymentReady()) return order;

  _payConfirmLock.add(order.id);
  try {
    const pay =
      order.paymentGateway === "rielpay"
        ? await rielPay.checkPayment(order.transactionId)
        : await khmerSystem.checkPayment(order.transactionId, { useKai: !!order.payViaKai });
    console.log("[pay-reconcile]", order.id, pay.status, pay.paid, pay.error || "", meta.source || "");
    if (!(assertPaymentProviderPaid(pay) && pay.paid === true && !pay.simulation && !pay.error)) {
      return order;
    }
    const paidAmt = Number(pay.amount ?? pay.total ?? pay.paid_amount);
    if (Number.isFinite(paidAmt) && paidAmt > 0 && Math.abs(paidAmt - Number(order.total)) > 0.05) {
      console.warn("[pay] amount mismatch BLOCKED", order.id, paidAmt, order.total);
      return updateOrder(order.id, {
        note: `Amount mismatch blocked provider=${paidAmt} order=${order.total}`,
      });
    }
    const fresh = getOrder(order.id);
    if (!fresh) return order;
    if (!(fresh.status === "pending" || (fresh.status === "failed" && !fresh.providerPaid))) {
      return fresh;
    }
    let updated = updateOrder(fresh.id, {
      status: "paid",
      paidAt: Date.now(),
      paidIp: meta.ip || fresh.paidIp || null,
      providerPaid: true,
      payStatusRaw: pay.status || "paid",
      note: ((fresh.note || "") + (meta.source === "reconcile" ? " | auto-reconcile after client left" : "")).trim(),
    });
    auditLog("payment_ok", {
      orderId: updated.id,
      total: updated.total,
      ip: meta.ip || null,
      status: pay.status,
      source: meta.source || "status",
    });
    if (tg.isKaiRouteOrder(updated) && updated.userId && !updated.ttkUsername) {
      try {
        const tt = await tiktokLookup.lookupTikTokLink(updated.userId);
        if (tt && (tt.username || tt.displayName)) {
          updated = updateOrder(updated.id, {
            ttkUsername: tt.username || null,
            ttkDisplayName: tt.displayName || null,
            ttkAuthorUrl: tt.authorUrl || null,
            ttkThumbnail: tt.thumbnail || null,
            ttkAvatarUrl: tt.avatarUrl || null,
            ttkResolvedUrl: tt.resolvedUrl || null,
            ttkTitle: tt.title || null,
          }) || updated;
        }
      } catch (e) {
        console.warn("[tiktok] lookup on paid", e.message);
      }
    }
    try {
      tg.notifyOrder("paid", updated).catch(() => {});
    } catch {}
    updated = await fulfillTopup(updated);
    if (updated && updated.status === "delivered") {
      try {
        tg.notifyOrder("delivered", updated).catch(() => {});
      } catch {}
    }
    return updated;
  } catch (e) {
    console.error("[pay-reconcile] error", order.id, e && e.message ? e.message : e);
    return order;
  } finally {
    _payConfirmLock.delete(order.id);
  }
}

/** Background: every 25s re-check pending ABA/KHQR payments even if user closed the page. */
async function reconcilePendingPayments() {
  if (!khmerSystem.isPaymentReady()) return;
  const all = listOrders() || [];
  const now = Date.now();
  // pending up to 48h (user paid, left page, admin delayed)
  const pending = all.filter((o) => {
    if (!o || !o.transactionId) return false;
    if (!(o.status === "pending" || (o.status === "failed" && !o.providerPaid))) return false;
    const age = now - (Number(o.createdAt) || 0);
    return age >= 0 && age < 48 * 60 * 60 * 1000;
  });
  pending.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  const batch = pending.slice(0, 40);
  for (const o of batch) {
    await tryConfirmPayment(o, { source: "reconcile" });
    await new Promise((r) => setTimeout(r, 150));
  }
}


/* ---------- RielPay webhook ---------- */
app.post("/api/webhook/rielpay", async (req, res) => {
  try {
    const raw = req.rawBody != null ? req.rawBody : JSON.stringify(req.body || {});
    const sig = req.get("X-Webhook-Signature") || req.get("x-webhook-signature") || "";
    if (rielPay.webhookSecret()) {
      const v = rielPay.verifyWebhookSignature(raw, sig);
      if (!v.ok) {
        console.warn("[rielpay webhook] bad signature", v.error);
        return res.status(400).json({ error: "invalid_signature" });
      }
    }
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const eventType = body?.type || body?.event || "";
    const data = body?.data || body?.payment || body;
    const status = String(data?.status || "").toLowerCase();
    const paid =
      eventType === "payment.succeeded" ||
      status === "paid" ||
      status === "succeeded" ||
      status === "success";
    if (!paid) return res.json({ ok: true, ignored: true });
    const payId = data?.id || data?.payment_id || "";
    const orderId =
      data?.metadata?.order_id ||
      data?.metadata?.orderId ||
      body?.metadata?.order_id ||
      "";
    let order = orderId ? getOrder(orderId) : null;
    if (!order && payId) {
      const all = listOrders() || [];
      order = (Array.isArray(all) ? all : []).find(
        (o) => o.transactionId === payId || (orderId && o.id === orderId)
      );
    }
    if (!order) {
      console.warn("[rielpay webhook] order not found", payId, orderId);
      return res.json({ ok: true, found: false });
    }
    if (["paid", "processing", "delivered", "queued"].includes(order.status)) {
      return res.json({ ok: true, already: order.status });
    }
    let updated = updateOrder(order.id, {
      status: "paid",
      paidAt: Date.now(),
      providerPaid: true,
      paymentGateway: "rielpay",
      payStatusRaw: status || "paid",
      transactionId: payId || order.transactionId,
    });
    updated = await fulfillTopup(updated);
    try { tg.notifyOrder("paid", updated).catch(() => {}); } catch {}
    return res.json({ ok: true, orderId: updated.id, status: updated.status });
  } catch (e) {
    console.error("[rielpay webhook]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/checkout/:id/status", limit("paystatus", { limit: 30, windowMs: 60_000 }), async (req, res) => {
  let order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });

  if (order.status === "failed" && (order.providerPaid || order.paidAt)) {
    order = updateOrder(order.id, {
      status: "paid",
      note: ((order.note || "") + " | recovered from false failed").trim(),
      needsManual: true,
    });
  }

  // Confirm payment even if browser was closed mid-pay — client poll OR later track page
  order = await tryConfirmPayment(order, { source: "status", ip: clientIp(req) });

  if (order.status === "processing" && (order.ktOrderCode || (order.ktOrderCodes || []).length)) {
    order = await pollKtStatus(order);
  }

  res.json({ order: publicOrder(order) });
});

app.get("/api/orders/track", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  let order = listOrders().find((o) => o.id.toLowerCase() === q);
  if (!order) return res.json([]);
  // User left pay page but opens Track later — still confirm + deliver
  order = await tryConfirmPayment(order, { source: "track", ip: clientIp(req) });
  if (order.status === "processing" && order.ktOrderCode) order = await pollKtStatus(order);
  res.json([publicOrder(order)]);
});

app.post("/api/admin/login", limit("login", { limit: 10, windowMs: 60_000 }), (req, res) => {
  const ip = clientIp(req);
  const allowed = checkLoginAllowed(ip);
  if (!allowed.ok) {
    res.setHeader("Retry-After", String(allowed.retryAfter));
    return res.status(429).json({ error: "locked", retryAfter: allowed.retryAfter });
  }
  const password = String(req.body?.password || "").trim();
  const expected = String(ADMIN_PASSWORD || "").trim();
  if (!password || !safeEq(password, expected)) {
    recordLoginFail(ip);
    auditLog("login_fail", { ip, reason: "bad_password" });
    return res.status(401).json({ error: "bad_password" });
  }
  clearLoginFails(ip);
  const { token, expires } = createSession();
  // sameSite=lax so mobile browsers / custom domains keep the session cookie
  res.cookie("porpor_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: expires - Date.now(),
    path: "/",
  });
  const csrf = issueCsrf(res, isProd);
  auditLog("login_ok", { ip });
  res.json({
    ok: true,
    expires,
    csrf,
    token, // fallback for clients that cannot store cookies
    weakPassword: isWeakAdminPassword(ADMIN_PASSWORD),
    totpEnabled: false,
  });
});


app.post("/api/admin/telegram/test", adminAuth, async (_req, res) => {
  const r = await tg.notifyChannel(
    "<b>✅ Porpor Topup</b>\nTelegram notify តភ្ជាប់រួច។\nOrder ថ្មីនឹងផ្ញើចូល channel នេះ។"
  );
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error || r.raw || "failed" });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  destroySession(req.cookies?.porpor_admin);
  res.clearCookie("porpor_admin", { path: "/" });
  res.json({ ok: true });
});


/** Full data backup (admin only) — download regularly */

app.get("/api/admin/audit-log", adminAuth, (req, res) => {
  const n = Math.min(500, Math.max(20, Number(req.query.limit) || 100));
  res.json({ events: readAuditLog(n) });
});

app.get("/api/admin/backups", adminAuth, (_req, res) => {
  res.json({ backups: listBackups() });
});

app.post("/api/admin/backups/run", adminAuth, (req, res) => {
  const dest = runAutoBackup();
  auditLog("backup_manual", { ip: clientIp(req), dest });
  res.json({ ok: true, dest, backups: listBackups() });
});

app.get("/api/admin/backup", adminAuth, (_req, res) => {
  try {
    const payload = exportFullBackup();
    const name = `porpor-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "backup_failed", message: String(e.message || e) });
  }
});

/** Restore full backup JSON (for server migration). Body = export payload. */
app.post("/api/admin/restore", adminAuth, (req, res) => {
  try {
    const body = req.body || {};
    const summary = importFullBackup(body);
    auditLog("restore_full", { ip: clientIp(req), ...summary });
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ error: "restore_failed", message: String(e.message || e) });
  }
});

app.get("/api/admin/me", (req, res) => {
  const token = req.cookies?.porpor_admin || req.headers["x-admin-token"];
  if (!validSession(token)) return res.status(401).json({ ok: false });
  res.json({
    ok: true,
    weakPassword: isWeakAdminPassword(ADMIN_PASSWORD),
    https: isProd,
  });
});


app.post("/api/admin/orders/:id/gift-code", adminAuth, (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: "not_found" });
  const code = String(req.body?.giftCode || req.body?.code || "").trim();
  if (!code) return res.status(400).json({ error: "empty_code" });
  const updated = updateOrder(o.id, {
    giftCode: code,
    status: "delivered",
    note: o.note || "Gift code delivered",
    deliveredAt: Date.now(),
  });
  res.json(updated);
});

app.get("/api/admin/stats", adminAuth, (_req, res) => {
  res.json(stats());
});


app.get("/api/admin/ips", adminAuth, (_req, res) => {
  const map = new Map();
  for (const o of listOrders()) {
    const ip = o.clientIp || o.paidIp || "unknown";
    const row = map.get(ip) || { ip, orders: 0, paid: 0, total: 0, lastAt: 0, samples: [] };
    row.orders += 1;
    if (o.status && o.status !== "pending" && o.status !== "failed") {
      row.paid += 1;
      row.total += Number(o.total) || 0;
    }
    row.lastAt = Math.max(row.lastAt, o.createdAt || 0);
    if (row.samples.length < 5) row.samples.push(o.id);
    map.set(ip, row);
  }
  const list = [...map.values()].sort((a, b) => b.lastAt - a.lastAt);
  res.json({ ips: list });
});

app.get("/api/admin/orders", adminAuth, (req, res) => {
  let list = listOrders();
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  if (q) {
    list = list.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        String(o.userId).toLowerCase().includes(q) ||
        String(o.gameName).toLowerCase().includes(q) ||
        String(o.nickname).toLowerCase().includes(q) ||
        String(o.clientIp || "").toLowerCase().includes(q) ||
        String(o.paidIp || "").toLowerCase().includes(q),
    );
  }
  if (status) list = list.filter((o) => (o.status || "delivered") === status);
  res.json(list);
});

app.get("/api/admin/orders/:id", adminAuth, (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: "not_found" });
  res.json(o);
});

app.patch("/api/admin/orders/:id", adminAuth, async (req, res) => {
  const patch = {};
  if (req.body?.status !== undefined) patch.status = req.body.status;
  if (req.body?.note !== undefined) patch.note = req.body.note;
  let o = updateOrder(req.params.id, patch);
  if (!o) return res.status(404).json({ error: "not_found" });
  if (req.body?.fulfill) {
    o = await fulfillTopup(o);
  }
  // TikTok Khmer → Kai bot/channel on done or rejected (never Porpor channel)
  try {
    const st = String(o.status || "").toLowerCase();
    if (st === "delivered" || st === "done") {
      tg.notifyOrder("delivered", o).catch(() => {});
    } else if (st === "rejected" || st === "cancelled" || st === "canceled") {
      tg.notifyOrder("rejected", o).catch(() => {});
    }
  } catch {}
  res.json(o);
});


/** Admin: re-check ABA payment for one order (stuck pending after real pay). */
app.post("/api/admin/orders/:id/recheck-pay", adminAuth, async (req, res) => {
  let o = getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: "not_found" });
  const before = o.status;
  o = await tryConfirmPayment(o, { source: "admin_recheck", ip: clientIp(req) });
  res.json({
    ok: true,
    before,
    after: o.status,
    paid: o.status !== "pending" && o.status !== "failed",
    order: o,
    payStatusRaw: o.payStatusRaw || null,
    note: o.note || null,
  });
});

/** Admin: re-check all recent pending payments. */
app.post("/api/admin/orders/recheck-pending", adminAuth, async (req, res) => {
  await reconcilePendingPayments();
  const pending = (listOrders() || []).filter((o) => o.status === "pending").length;
  res.json({ ok: true, stillPending: pending });
});

/** Admin: force mark paid (when ABA paid but API check fails) then fulfill. */
app.post("/api/admin/orders/:id/force-paid", adminAuth, async (req, res) => {
  let o = getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: "not_found" });
  if (o.status === "delivered" || o.status === "done") {
    return res.json({ ok: true, order: o, skipped: "already_done" });
  }
  o = updateOrder(o.id, {
    status: "paid",
    paidAt: o.paidAt || Date.now(),
    providerPaid: true,
    note: ((o.note || "") + " | admin force-paid").trim(),
  });
  auditLog("payment_force", { orderId: o.id, ip: clientIp(req), admin: true });
  try { tg.notifyOrder("paid", o).catch(() => {}); } catch {}
  o = await fulfillTopup(o);
  if (o && (o.status === "delivered" || o.status === "done")) {
    try { tg.notifyOrder("delivered", o).catch(() => {}); } catch {}
  }
  res.json({ ok: true, order: o });
});

app.delete("/api/admin/orders/:id", adminAuth, (req, res) => {
  if (!deleteOrder(req.params.id)) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

/** Only allow our own uploads or https image URLs (blocks javascript:/data: URLs). */
function cleanImageUrl(v) {
  const s = String(v || "").trim();
  if (/^\/uploads\/[\w.-]{1,100}$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,500}$/.test(s)) return s;
  return "";
}


app.get("/api/admin/rielpay-test", adminAuth, async (_req, res) => {
  try {
    res.json(await rielPay.diagnose());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/settings", adminAuth, (_req, res) => {
  const s = getSettings() || {};
  // never send full cookie to browser listing — mask in GET
  const out = { ...s };
  if (out.robuxCookie) out.robuxCookie = "••••••••";
  if (out.robuxTotpSecret) out.robuxTotpSecret = "••••••••";
  if (out.rielpayApiKey) out.rielpayApiKey = "••••••••";
  if (out.rielpayWebhookSecret) out.rielpayWebhookSecret = "••••••••";
  res.json(out);
});

app.get("/api/admin/robux-auto/test", adminAuth, async (_req, res) => {
  try {
    const s = getSettings() || {};
    const funds = await robloxPayout.checkGroupFunds();
    res.json({
      ready: robloxPayout.isRobuxAutoReady(),
      enabled: !!s.robuxAutoEnabled,
      groupId: s.robuxGroupId || null,
      hasCookie: !!(s.robuxCookie && String(s.robuxCookie).length > 20),
      hasTotp: !!(s.robuxTotpSecret && String(s.robuxTotpSecret).length > 8),
      funds,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.put("/api/admin/settings", adminAuth, (req, res) => {
  const body = req.body || {};
  const allowed = [
    "siteName", "taglineKm", "taglineEn", "telegram", "announcementKm", "announcementEn", "kaiBotToken", "kaiOrderBotToken", "kaiBotUsername", "kaiChatId", "kaiChannelId", "kaiRouteGames", "kaiAbaKey", "kaiAbaMerchant",
    "supportEmail", "maintenance", "coupons", "autoTopup", "topupProvider", "logoUrl", "bannerUrls", "localProducts",
    "deliveryHours", "tickerSoldBase", "tickerSoldLabel", "resellers", "resellerPrices",
    "tgBotToken", "tgBotUsername", "tgChannelId",
    "robuxAutoEnabled", "robuxCookie", "robuxGroupId", "robuxTotpSecret",
    "paymentGateway", "rielpayApiKey", "rielpayWebhookSecret",
  ];
  const patch = {};
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.topupProvider !== undefined) {
    const v = String(patch.topupProvider || "khmer").toLowerCase();
    patch.topupProvider = ["khmer", "dino", "both"].includes(v) ? v : "khmer";
  }
  if (patch.logoUrl !== undefined) patch.logoUrl = cleanImageUrl(patch.logoUrl);
  if (patch.logoUrl !== undefined) branding.clearBrandingCache();
  if (patch.bannerUrls !== undefined) {
    patch.bannerUrls = (Array.isArray(patch.bannerUrls) ? patch.bannerUrls : [])
      .map(cleanImageUrl)
      .filter(Boolean)
      .slice(0, 5);
  }
  // Resellers: username list (Telegram) + optional telegramId; fixed prices by pack id
  if (patch.resellers !== undefined) {
    patch.resellers = (Array.isArray(patch.resellers) ? patch.resellers : [])
      .map((r) => ({
        username: String(r.username || "").trim().replace(/^@/, "").toLowerCase().slice(0, 64),
        telegramId: r.telegramId ? Number(r.telegramId) || null : null,
        active: r.active !== false,
        note: String(r.note || "").slice(0, 120),
      }))
      .filter((r) => r.username || r.telegramId)
      .slice(0, 200);
  }
  if (patch.tgBotToken !== undefined) {
    const tok = String(patch.tgBotToken || "").trim().slice(0, 200);
    // empty string would wipe a previously saved token on accidental re-save
    if (!tok) delete patch.tgBotToken;
    else patch.tgBotToken = tok;
  }
  if (patch.robuxCookie !== undefined) {
    const c = String(patch.robuxCookie || "").trim();
    if (!c) delete patch.robuxCookie;
    else patch.robuxCookie = c.slice(0, 4096);
  }
  if (patch.robuxTotpSecret !== undefined) {
    const s = String(patch.robuxTotpSecret || "").trim().replace(/\s+/g, "");
    if (!s) delete patch.robuxTotpSecret;
    else patch.robuxTotpSecret = s.slice(0, 128);
  }
  if (patch.robuxGroupId !== undefined) {
    patch.robuxGroupId = String(patch.robuxGroupId || "").replace(/\D/g, "").slice(0, 20);
  }
  if (patch.robuxAutoEnabled !== undefined) {
    patch.robuxAutoEnabled = !!patch.robuxAutoEnabled;
  }
  if (patch.rielpayApiKey !== undefined) {
    const k = String(patch.rielpayApiKey || "").trim();
    if (!k || k === "••••••••") delete patch.rielpayApiKey;
    else patch.rielpayApiKey = k.slice(0, 200);
  }
  if (patch.rielpayWebhookSecret !== undefined) {
    const k = String(patch.rielpayWebhookSecret || "").trim();
    if (!k || k === "••••••••") delete patch.rielpayWebhookSecret;
    else patch.rielpayWebhookSecret = k.slice(0, 200);
  }
  if (patch.paymentGateway !== undefined) {
    const g = String(patch.paymentGateway || "khmer").toLowerCase();
    patch.paymentGateway = ["khmer", "rielpay"].includes(g) ? g : "khmer";
  }
  if (patch.tgChannelId !== undefined) {
    patch.tgChannelId = String(patch.tgChannelId || "").trim().slice(0, 64);
  }
  if (patch.tgBotUsername !== undefined) {
    patch.tgBotUsername = String(patch.tgBotUsername || "").trim().replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 64);
  }
  if (patch.resellerPrices !== undefined) {
    const src = patch.resellerPrices && typeof patch.resellerPrices === "object" ? patch.resellerPrices : {};
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      const id = String(k).trim().slice(0, 80);
      const n = Number(v);
      if (!id || !Number.isFinite(n) || n <= 0) continue;
      out[id] = Math.round(n * 100) / 100;
    }
    patch.resellerPrices = out;
  }
  res.json(updateSettings(patch));
});

app.get("/api/admin/payment-test", adminAuth, async (_req, res) => {
  res.json(await khmerSystem.diagnose());
});

app.get("/api/admin/integrations", adminAuth, async (_req, res) => {
  const out = {
    paymentReady: khmerSystem.isPaymentReady(),
    topupReady: khmerTopup.isTopupReady(),
    balance: null,
    gamesCount: null,
    error: null,
  };
  if (khmerTopup.isTopupReady()) {
    try {
      const me = await khmerTopup.getBalance();
      out.balance = me.balance;
      out.username = me.username;
      const g = await khmerTopup.listGames();
      out.gamesCount = (g.games || []).length;
    } catch (e) {
      out.error = e.message;
    }
  }
  res.json(out);
});



app.get("/api/admin/gift-stock", adminAuth, (_req, res) => {
  res.json({ stock: getGiftStock(), counts: stockSummary() });
});

app.put("/api/admin/gift-stock/:packId", adminAuth, (req, res) => {
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "bad_pack" });
  const mode = String(req.body?.mode || "replace");
  const raw = req.body?.codes;
  let codes = [];
  if (typeof raw === "string") {
    codes = raw.split(/[\n,;]+/);
  } else if (Array.isArray(raw)) {
    codes = raw;
  }
  mode === "append" ? addPackStock(packId, codes) : setPackStock(packId, codes);
  const autoDelivered = fulfillAwaitingStock(packId);
  const count = stockCount(packId);
  res.json({ packId, count, autoDelivered, stock: getGiftStock()[packId] || [] });
});

app.get("/api/admin/local-products", adminAuth, (_req, res) => {
  const s = getSettings();
  let products;
  const usingDefaults = !(Array.isArray(s.localProducts) && s.localProducts.length);
  if (!usingDefaults) {
    const byId = new Map(s.localProducts.map((g) => [String(g.id), g]));
    for (const d of DEFAULT_LOCAL_PRODUCTS) {
      if (!byId.has(String(d.id))) byId.set(String(d.id), d);
    }
    products = [...byId.values()];
  } else {
    products = DEFAULT_LOCAL_PRODUCTS;
  }
  res.json({
    products,
    usingDefaults,
    stockCounts: stockSummary(),
  });
});

app.put("/api/admin/local-products", adminAuth, (req, res) => {
  const body = req.body || {};
  let list = Array.isArray(body.products) ? body.products : [];
  // sanitize
  list = list
    .map((g) => {
      if (!g || !g.id) return null;
      const packs = (Array.isArray(g.packs) ? g.packs : [])
        .map((p) => {
          let img = String(p.image || "").trim();
          if (!(/^\/uploads\/[\w.-]{1,100}$/.test(img) || /^https:\/\/[^\s"'<>]{1,490}$/.test(img))) img = "";
          return {
            id: String(p.id || "").trim(),
            name: String(p.name || p.id || "").trim(),
            nameKm: String(p.nameKm || p.name || p.id || "").trim(),
            price: Number(p.price),
            cost: Number(p.cost != null ? p.cost : p.price),
            category: (String(p.category || "").trim().toLowerCase() === "gift card" ? "Roblox" : String(p.category || "Roblox")),
            bonus: p.bonus ? String(p.bonus) : "",
            image: img,
          };
        })
        .filter((p) => p.id && Number.isFinite(p.price) && p.price > 0);
      return {
        id: String(g.id).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: String(g.name || g.id).trim(),
        nameKm: String(g.nameKm || g.name || g.id).trim(),
        region: String(g.region || ""),
        blurbKm: String(g.blurbKm || ""),
        blurbEn: String(g.blurbEn || ""),
        famous: !!g.famous,
        hot: !!g.hot,
        open: g.open !== false,
        showWhenOff: !!g.showWhenOff,
        hue: Number(g.hue) || 210,
        mark: String(g.mark || "GC").slice(0, 4),
        image: (function () {
          let u = String(g.image || "").trim();
          if (/^\/uploads\/[\w.-]{1,100}$/.test(u) || /^\/icons\/[\w.-]{1,100}$/.test(u) || /^https:\/\/[^\s"'<>]{1,490}$/.test(u)) return u;
          return "";
        })(),
        banners: cleanBanners(g.banners, g.banner),
        banner: cleanBanners(g.banners, g.banner)[0] || "",
        deliveryType: ["stock", "live_chat", "robux_send", "gift_code", "topup"].includes(g.deliveryType)
          ? (g.deliveryType === "gift_code" ? "stock" : g.deliveryType)
          : "stock",
        requireUsername: !!g.requireUsername,
        hasZone: false,
        servers: [],
        idHintKm: String(g.idHintKm || ""),
        idHintEn: String(g.idHintEn || ""),
        tutorialVideoUrl: (() => {
          const u = String(g.tutorialVideoUrl || "").trim();
          if (/^\/uploads\/[\w.-]{1,120}$/.test(u)) return u;
          if (/^https:\/\/[^\s"'<>]{1,490}$/.test(u)) return u;
          return "";
        })(),
        tutorialVideoTitle: String(g.tutorialVideoTitle || "").trim().slice(0, 120),
        customerNoteKm: String(g.customerNoteKm || "").trim().slice(0, 1000),
        customerNoteEn: String(g.customerNoteEn || "").trim().slice(0, 1000),
        supportContact: String(g.supportContact || "https://t.me/kairozen_support").trim().slice(0, 120),
        safetyGuide: (() => {
          const sg = g.safetyGuide && typeof g.safetyGuide === "object" ? g.safetyGuide : {};
          const stepsKm = Array.isArray(sg.stepsKm)
            ? sg.stepsKm.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 6)
            : [];
          const stepsEn = Array.isArray(sg.stepsEn)
            ? sg.stepsEn.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 6)
            : stepsKm;
          return {
            enabled: !!sg.enabled,
            titleKm: String(sg.titleKm || "សូមអានមុនបន្ត").slice(0, 80),
            titleEn: String(sg.titleEn || "Please read before continuing").slice(0, 80),
            stepsKm,
            stepsEn,
          };
        })(),
        packs,
      };
    })
    .filter(Boolean);
  const updated = updateSettings({ localProducts: list });
  res.json({ products: updated.localProducts || list });
});

app.get("/api/admin/kt-games", adminAuth, async (req, res) => {
  if (!khmerTopup.isTopupReady()) {
    return res.status(503).json({ error: "KHMER_TOPUP_API_KEY not set" });
  }
  try {
    const games = await catalog.fetchSupplierGames(true);
    const out = { games, selection: getSettings().ktSelection };
    if (req.query.raw) out.raw = catalog.rawSupplierGames();
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.put("/api/admin/kt-selection", adminAuth, (req, res) => {
  const selection = catalog.sanitizeSelection(req.body);
  updateSettings({ ktSelection: selection });
  res.json({ selection });
});

app.get("/api/admin/dino-games", adminAuth, async (req, res) => {
  if (!dinoTopup.isDinoReady()) {
    return res.status(503).json({ error: "DINO_TOPUP_API_KEY not set" });
  }
  try {
    const want = String(req.query.game || "").trim();
    const skipped = [];
    let games = [];

    if (want) {
      try {
        const data = await dinoTopup.listProducts(want);
        games = dinoTopup.normalizeGamesPayload(data);
      } catch (e) {
        skipped.push({ game: want, error: e.message });
      }
    } else {
      // 1) Full catalog without filter (docs: game optional)
      try {
        const data = await dinoTopup.listProducts();
        games = dinoTopup.normalizeGamesPayload(data);
      } catch (e) {
        skipped.push({ game: "*", error: e.message });
      }

      // 2) If API returned few games, merge common ids individually
      const known = [
        "ml", "ff", "pubg", "hok", "genshin", "roblox",
        "valorant", "codm", "aov", "wildrift", "lol",
        "steam", "itunes", "google-play", "delta", "blood-strike",
        "honor", "zepeto", "magic-chess", "lifeafter", "identity-v",
      ];
      const have = new Set(games.map((g) => String(g.slug).toLowerCase()));
      if (games.length < 8) {
        for (const gid of known) {
          if (have.has(gid)) continue;
          try {
            const data = await dinoTopup.listProducts(gid);
            for (const g of dinoTopup.normalizeGamesPayload(data)) {
              const key = String(g.slug).toLowerCase();
              if (have.has(key)) continue;
              have.add(key);
              games.push(g);
            }
          } catch (e) {
            skipped.push({ game: gid, error: e.message || e.code || "fail" });
          }
        }
      }
    }

    // de-dupe by slug
    const seen = new Set();
    const uniq = [];
    for (const g of games) {
      const k = String(g.slug).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(g);
    }

    res.json({
      games: uniq,
      count: uniq.length,
      skipped: skipped.slice(0, 30),
      selection: getSettings().dinoSelection || { markupPercent: 0, games: {} },
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.put("/api/admin/dino-selection", adminAuth, (req, res) => {
  const selection = catalog.sanitizeSelection(req.body);
  updateSettings({ dinoSelection: selection });
  res.json({ selection });
});

/* ---------- Price watch (Khmer + Dino) ---------- */
app.get("/api/admin/kt-prices", adminAuth, async (req, res) => {
  const provider = String(req.query.provider || "khmer").toLowerCase() === "dino" ? "dino" : "khmer";
  if (provider === "khmer" && !khmerTopup.isTopupReady()) {
    return res.status(503).json({ error: "KHMER_TOPUP_API_KEY not set" });
  }
  if (provider === "dino" && !dinoTopup.isDinoReady()) {
    return res.status(503).json({ error: "DINO_TOPUP_API_KEY not set" });
  }
  try {
    const data = await priceWatch.latestChanges(provider);
    res.json({ ok: true, ...data, snapshots: priceWatch.listSnapshots(provider, 15) });
  } catch (e) {
    console.error("[kt-prices]", e);
    res.status(502).json({ ok: false, error: e.message || String(e) });
  }
});

app.post("/api/admin/kt-prices/snapshot", adminAuth, async (req, res) => {
  const provider = String(req.body?.provider || req.query.provider || "khmer").toLowerCase() === "dino" ? "dino" : "khmer";
  if (provider === "khmer" && !khmerTopup.isTopupReady()) {
    return res.status(503).json({ error: "KHMER_TOPUP_API_KEY not set" });
  }
  if (provider === "dino" && !dinoTopup.isDinoReady()) {
    return res.status(503).json({ error: "DINO_TOPUP_API_KEY not set" });
  }
  try {
    const r = await priceWatch.takeSnapshot(provider, { force: true });
    // Don't serialize full prices map to client (huge)
    res.json({
      ok: true,
      skipped: r.skipped,
      provider: r.provider,
      previousAt: r.previousAt || null,
      snapshot: r.snapshot ? { at: r.snapshot.at, count: r.snapshot.count } : null,
      changes: r.changes || [],
      snapshots: priceWatch.listSnapshots(provider, 15),
    });
  } catch (e) {
    console.error("[kt-prices/snapshot]", e);
    res.status(502).json({ ok: false, error: e.message || String(e) });
  }
});



/* ---------- Image uploads (game + package images) ---------- */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    index: false,
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);

/** Identify the image from its real bytes (never trust the filename / content-type). SVG is rejected on purpose. */
function sniffImage(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

app.post("/api/admin/upload", adminAuth, express.raw({ type: () => true, limit: "4mb" }), (req, res) => {
  const ext = sniffImage(req.body);
  if (!ext) return res.status(400).json({ error: "bad_image" });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  res.json({ url: `/uploads/${name}` });
});

/** Identify mp4/mov/webm from real bytes (never trust filename / content-type). */
function sniffVideo(b) {
  if (!Buffer.isBuffer(b) || b.length < 16) return null;
  if (b.toString("ascii", 4, 8) === "ftyp") return "mp4"; // mp4 / m4v / mov (iPhone)
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

/* Tutorial video upload (TikTok Khmer admin) — max 60MB, mp4 / mov / webm */
app.post("/api/admin/upload-video", adminAuth, express.raw({ type: () => true, limit: "60mb" }), (req, res) => {
  const ext = sniffVideo(req.body);
  if (!ext) return res.status(400).json({ error: "bad_video" });
  const name = `vid-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  res.json({ url: `/uploads/${name}`, size: req.body.length });
});

/* ---------- Branding: favicon / app icon / manifest follow the logo uploaded in Admin ---------- */
const ICON_CACHE = "public, max-age=3600"; // links carry ?v=<logo hash>, so a new logo is picked up immediately
function defaultIconPath(file) {
  for (const base of [path.join(DIST, "icons"), path.join(ROOT, "public", "icons")]) {
    const p = path.join(base, file);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
async function sendIcon(res, size, kind, fallbackFile) {
  const r = await branding.renderLogo(size, kind).catch(() => null);
  res.setHeader("Cache-Control", ICON_CACHE);
  if (r) return res.type(r.type).send(r.buf);
  const p = defaultIconPath(fallbackFile);
  return p ? res.sendFile(p) : res.status(404).end();
}
const ICON_ROUTES = [
  ["/favicon-48.png", 48, "any", "icon-192.png"],
  ["/favicon.ico", 48, "any", "icon-192.png"],
  ["/apple-touch-icon.png", 180, "apple", "apple-touch-icon.png"],
  ["/icons/app-192.png", 192, "any", "icon-192.png"],
  ["/icons/app-512.png", 512, "any", "icon-512.png"],
  ["/icons/app-maskable-192.png", 192, "maskable", "maskable-192.png"],
  ["/icons/app-maskable-512.png", 512, "maskable", "maskable-512.png"],
];
for (const [route, size, kind, fallback] of ICON_ROUTES) {
  app.get(route, (_req, res) => sendIcon(res, size, kind, fallback));
}
app.get("/manifest.webmanifest", (_req, res) => {
  let base = {};
  for (const p of [path.join(DIST, "manifest.webmanifest"), path.join(ROOT, "public", "manifest.webmanifest")]) {
    try {
      base = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    } catch {}
  }
  res.setHeader("Cache-Control", "no-cache");
  res.type("application/manifest+json").send(JSON.stringify(branding.buildManifest(base)));
});

/** OPEN ABA Mobile — MUST be before SPA catch-all or React treats /open-aba as admin */
app.get("/open-aba", (req, res) => khmerSystemPay.openAbaRoute(req, res));

if (fs.existsSync(DIST)) {
  // Serve assets but NEVER auto-serve index.html (we inject ADMIN_PATH ourselves)
  app.use(
    express.static(DIST, {
      index: false,
      maxAge: isProd ? "7d" : 0,
      setHeaders: (res, filePath) => {
        const f = path.basename(filePath);
        // The service worker + manifest must always be revalidated so app updates reach installed users.
        if (f === "sw.js" || f === "manifest.webmanifest" || f === "offline.html") {
          res.setHeader("Cache-Control", "no-cache");
        }
        if (f === "sw.js") res.setHeader("Service-Worker-Allowed", "/");
        if (f === "manifest.webmanifest") res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const htmlPath = path.join(DIST, "index.html");
    try {
      let html = fs.readFileSync(htmlPath, "utf8");
      if (branding.hasLogo()) {
        // Replace the default favicon / manifest links with ones that point to the admin logo
        html = html
          .replace(/<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>\s*/g, "")
          .replace("</head>", `    ${branding.headTags(`${req.protocol}://${req.get("host")}`)}\n  </head>`);
      }
      const inj = `<script>window.__ADMIN_PATH__=${JSON.stringify(ADMIN_PATH)};</script>`;
      if (html.includes("window.__ADMIN_PATH__")) {
        html = html.replace(/<script>window\.__ADMIN_PATH__=.*?<\/script>/, inj);
      } else if (html.includes("</head>")) {
        html = html.replace("</head>", inj + "</head>");
      } else {
        html = inj + html;
      }
      res.type("html").send(html);
    } catch {
      res.sendFile(htmlPath);
    }
  });
} else {
  app.get("/", (_req, res) => {
    res.type("html").send(
      `<h1>Porpor TOPUP API</h1><p>payment=${khmerSystem.isPaymentReady()} topup=${khmerTopup.isTopupReady()}</p>`,
    );
  });
}

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "too_large" });
  if (res.headersSent) return next(err);
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

// Auto backup every 5 hours → disk + Telegram bot/channel
async function backupAndSendTelegram() {
  try {
    const dest = runAutoBackup();
    if (dest) auditLog("backup_auto", { dest });
  } catch (e) {
    console.error("[backup]", e.message);
  }
  try {
    const payload = exportFullBackup();
    const r = await tg.sendBackupToTelegram(payload);
    auditLog("backup_telegram", { ok: !!r?.ok, error: r?.error || null });
  } catch (e) {
    console.error("[backup-telegram]", e.message);
  }
}
setInterval(() => {
  backupAndSendTelegram();
}, 5 * 60 * 60 * 1000).unref?.();
// first run ~2 min after boot (avoid cold-start race)
setTimeout(() => {
  backupAndSendTelegram();
}, 2 * 60 * 1000).unref?.();




/** Worker / admin helper: list Robux Send queue (secret or admin session). */
function robuxWorkerAuth(req) {
  const secret = (process.env.ROBUX_WORKER_SECRET || process.env.ADMIN_TOKEN || "").trim();
  const h = String(req.headers["x-robux-secret"] || req.headers["x-admin-token"] || "").trim();
  if (secret && h && safeEq(h, secret)) return true;
  return false;
}

app.get("/api/robux/pending", (req, res) => {
  if (!robuxWorkerAuth(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const all = listOrders();
  const pending = (all || []).filter(
    (o) =>
      o &&
      (o.status === "queued" || o.status === "paid" || o.status === "processing") &&
      (o.deliveryType === "robux_send" || o.deliveryType === "live_chat") &&
      o.needsManual
  );
  res.json({
    ok: true,
    orders: pending.map((o) => ({
      id: o.id,
      userId: o.userId,
      gameName: o.gameName,
      packName: o.packName,
      qty: o.qty,
      total: o.total,
      status: o.status,
      paidAt: o.paidAt,
      note: o.note,
    })),
  });
});

app.post("/api/robux/complete", express.json(), (req, res) => {
  if (!robuxWorkerAuth(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const id = String(req.body?.orderId || "").trim();
  const receipt = String(req.body?.receipt || "").trim().slice(0, 200);
  if (!id) return res.status(400).json({ ok: false, error: "orderId required" });
  const o = getOrder(id);
  if (!o) return res.status(404).json({ ok: false, error: "not_found" });
  if (!["queued", "paid", "processing"].includes(o.status)) {
    return res.status(400).json({ ok: false, error: "bad_status", status: o.status });
  }
  const updated = updateOrder(id, {
    status: "delivered",
    needsManual: false,
    deliveredAt: Date.now(),
    transferReceipt: receipt || o.transferReceipt || "",
    note: (o.note || "") + (receipt ? ` | receipt ${receipt}` : " | marked delivered"),
  });
  try { tg.notifyOrder("delivered", updated).catch(() => {}); } catch {}
  res.json({ ok: true, order: publicOrder(updated) });
});




// —— Dino Topups webhook (order.updated) ——
app.post("/api/webhook/dino", async (req, res) => {
  try {
    const secret = (process.env.DINO_WEBHOOK_SECRET || getSettings().dinoWebhookSecret || "").trim();
    // Unsigned webhooks are never accepted (anyone could otherwise change order status)
    if (!secret) return res.status(503).json({ ok: false, error: "webhook_secret_not_set" });
    const raw = typeof req.rawBody === "string" ? req.rawBody : "";
    const ts = req.headers["x-dino-timestamp"];
    const sig = req.headers["x-dino-signature"];
    if (!raw || !dinoTopup.verifyWebhookSignature(raw, ts, sig, secret)) {
      return res.status(401).json({ ok: false, error: "bad_signature" });
    }
    const event = typeof req.body === "object" && req.body ? req.body : JSON.parse(raw || "{}");
    const data = event.data?.order || event.order || event.data || {};
    const ref = data.reference || data.order_id;
    if (ref) {
      const orders = typeof listOrders === "function" ? listOrders() : getOrders();
      const list = Array.isArray(orders) ? orders : (orders?.orders || []);
      const o = list.find((x) => x.id === ref || x.dinoOrderId === data.order_id || x.dinoReference === String(ref));
      // Only orders that really were paid may be changed by a provider webhook
      const payable = o && (o.providerPaid || ["paid", "processing", "queued", "done", "delivered"].includes(o.status));
      if (o && payable) {
        const st = dinoTopup.summarizeDinoStatus(data.status);
        updateOrder(o.id, {
          dinoStatus: data.status,
          dinoOrderId: data.order_id || o.dinoOrderId,
          status: data.status === "success" ? "done" : data.status === "failed" ? "paid" : st.done ? o.status : "processing",
          note: `Dino webhook: ${data.status}`,
          needsManual: data.status === "failed",
        });
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("dino webhook", e.message);
    res.status(200).json({ ok: true });
  }
});

app.get("/api/admin/dino/balance", adminAuth, async (_req, res) => {
  if (!dinoTopup.isDinoReady()) return res.status(503).json({ ok: false, error: "not_configured" });
  try {
    res.json({ ok: true, ...(await dinoTopup.getBalance()) });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get("/api/admin/dino/products", adminAuth, async (req, res) => {
  if (!dinoTopup.isDinoReady()) return res.status(503).json({ ok: false, error: "not_configured" });
  try {
    res.json(await dinoTopup.listProducts(req.query.game));
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

/* Safety net: every minute (and shortly after boot) deliver any order still waiting for stock */
setInterval(() => fulfillAwaitingStock(), 60 * 1000).unref?.();
setInterval(() => { reconcilePendingPayments().catch((e) => console.error('[pay-reconcile]', e)); }, 25 * 1000).unref?.();
setTimeout(() => { reconcilePendingPayments().catch(() => {}); }, 15 * 1000).unref?.();

setTimeout(() => fulfillAwaitingStock(), 10 * 1000).unref?.();

app.listen(PORT, () => {
  console.log(`Porpor TOPUP on :${PORT}`);
  catalog.warmCatalog();
  if (isWeakAdminPassword(ADMIN_PASSWORD)) {
    console.warn("[security] ADMIN_PASSWORD is weak or default — set a strong password in Render env (12+ chars, letters+numbers)");
  }
  if (isProd) {
    console.log("[security] HSTS + CSP headers enabled; use Cloudflare WAF in front of the domain");
  }
  console.log(`  ABA PayWay payment: ${khmerSystem.isPaymentReady() ? "READY" : "NOT CONFIGURED"}`);
  console.log(`  Khmer TopUp auto:     ${khmerTopup.isTopupReady() ? "READY" : "NOT CONFIGURED"}`);
});
