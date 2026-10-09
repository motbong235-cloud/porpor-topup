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
} from "./store.js";
import * as khmerSystem from "./khmerSystem.js";
import * as khmerTopup from "./khmerTopup.js";
import * as catalog from "./catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "porpor-admin-2026";
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

function adminAuth(req, res, next) {
  const token = req.cookies?.porpor_admin || req.headers["x-admin-token"];
  if (!validSession(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function newCode() {
  return `PP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
  };
}

function summarizeKt(codes, statuses) {
  const vals = codes.map((c) => String(statuses[c] || "").toLowerCase());
  if (vals.length && vals.every((v) => v === "completed")) return { status: "delivered" };
  if (vals.some((v) => v === "refunded")) return { status: "failed", note: "Supplier refunded" };
  return { status: "processing" };
}

async function fulfillTopup(order) {
  const settings = getSettings();
  if (!settings.autoTopup) {
    return updateOrder(order.id, { status: "paid", note: "autoTopup disabled — fulfill manually" });
  }
  if (!khmerTopup.isTopupReady()) {
    return updateOrder(order.id, {
      status: "paid",
      note: "KHMER_TOPUP_API_KEY missing — paid but not auto-delivered",
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
  updateOrder(order.id, { status: "processing" });

  try {
    // one Khmer TopUp order per unit, so qty > 1 delivers everything the customer paid for
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
      status: "failed",
      ktOrderCodes: codes,
      ktOrderCode: codes[0],
      ktStatuses: statuses,
      note: `TopUp error after ${codes.length}/${order.qty || 1} placed: ${e.message}`,
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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "Porpor TOPUP",
    payment: khmerSystem.isPaymentReady(),
    topup: khmerTopup.isTopupReady(),
  });
});

app.get("/api/integrations/status", (_req, res) => {
  const s = getSettings();
  res.json({
    paymentReady: khmerSystem.isPaymentReady(),
    topupReady: khmerTopup.isTopupReady(),
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
    coupons: (s.coupons || []).map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      min: c.min,
    })),
  });
});

/** Games + packages the admin selected from Khmer TopUp (prices include markup). */
app.get("/api/catalog", async (_req, res) => {
  if (!khmerTopup.isTopupReady()) {
    return res.json({ games: [], error: "topup_not_configured" });
  }
  try {
    res.json({ games: await catalog.publicCatalog() });
  } catch (e) {
    res.status(502).json({ games: [], error: "catalog_unavailable", message: e.message });
  }
});

app.post("/api/verify", async (req, res) => {
  const { slug, playerId, serverId } = req.body || {};
  if (!slug || !playerId) return res.status(400).json({ result: "incomplete", message: "slug and playerId required" });
  if (!khmerTopup.isTopupReady()) {
    return res.status(503).json({ result: "unknown", error: "topup_not_configured" });
  }
  try {
    const game = await catalog.findGame(slug);
    if (!game) return res.status(404).json({ result: "unknown", error: "game_unavailable" });
    const data = await khmerTopup.verifyAccount(slug, playerId, serverId);
    return res.json(data);
  } catch (e) {
    return res.json({ result: "unknown", error: e.message });
  }
});

app.post("/api/checkout/create", async (req, res) => {
  const body = req.body || {};
  const settings = getSettings();
  if (settings.maintenance) {
    return res.status(503).json({ error: "maintenance" });
  }
  if (!khmerTopup.isTopupReady() || !khmerSystem.isPaymentReady()) {
    return res.status(503).json({ error: "not_configured" });
  }

  const userId = String(body.userId || "").trim();
  if (!body.gameId || !body.packId || userId.length < 3) {
    return res.status(400).json({ error: "invalid" });
  }

  // Price comes from the server catalog — never trust the client total.
  let found;
  try {
    found = await catalog.findPack(body.gameId, body.packId);
  } catch (e) {
    return res.status(502).json({ error: "catalog_unavailable" });
  }
  if (!found) return res.status(400).json({ error: "pack_unavailable" });

  const zoneId = String(body.zoneId || "").trim();
  const server = String(body.server || "").trim();
  if (found.game.hasZone && !zoneId) return res.status(400).json({ error: "need_zone" });
  if (found.game.servers.length && !found.game.servers.some((s) => s.value === server)) {
    return res.status(400).json({ error: "need_server" });
  }

  const qty = Math.min(10, Math.max(1, Math.floor(Number(body.qty)) || 1));
  const subtotal = round2(found.pack.price * qty);
  const cp = calcCoupon(settings, body.coupon, subtotal);
  if (!cp.ok) return res.status(400).json({ error: cp.error });
  const total = round2(subtotal - cp.discount);
  if (!(total > 0)) return res.status(400).json({ error: "invalid" });

  const order = createOrder({
    id: uniqueCode(),
    gameId: found.game.id,
    gameName: found.game.name,
    packId: found.pack.id,
    packName: found.pack.name,
    qty,
    total,
    discount: cp.discount,
    cost: round2(found.pack.cost * qty),
    userId,
    zoneId,
    server,
    nickname: String(body.nickname || ""),
    method: "khqr",
    coupon: cp.code,
    ktPackageId: Number(found.pack.id),
    status: "pending",
    createdAt: Date.now(),
  });

  const qr = await khmerSystem.createQr(order.total, order.id, `${order.gameName} ${order.packName}`);
  if (!qr.success) {
    updateOrder(order.id, { status: "failed", note: qr.error });
    return res.status(502).json({ error: qr.error || "qr_failed" });
  }
  const updated = updateOrder(order.id, {
    transactionId: qr.transaction_id,
    qrImage: qr.qr_image,
    qrString: qr.qr_string,
  });
  return res.json({
    order: publicOrder(updated),
    payment: {
      transactionId: qr.transaction_id,
      qrImage: qr.qr_image,
      qrString: qr.qr_string,
    },
  });
});

app.get("/api/checkout/:id/status", async (req, res) => {
  let order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });

  if (order.status === "pending" && order.transactionId && khmerSystem.isPaymentReady()) {
    const pay = await khmerSystem.checkPayment(order.transactionId);
    if (pay.paid) {
      // claim atomically (sync read+write) so concurrent polls can't fulfill twice
      const fresh = getOrder(order.id);
      if (fresh && fresh.status === "pending") {
        order = updateOrder(order.id, { status: "paid", paidAt: Date.now() });
        order = await fulfillTopup(order);
      } else if (fresh) {
        order = fresh;
      }
    }
  }

  if (order.status === "processing" && order.ktOrderCode) {
    order = await pollKtStatus(order);
  }

  res.json({ order: publicOrder(order) });
});

app.get("/api/orders/track", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  let order = listOrders().find((o) => o.id.toLowerCase() === q);
  if (!order) return res.json([]);
  if (order.status === "processing" && order.ktOrderCode) order = await pollKtStatus(order);
  res.json([publicOrder(order)]);
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "bad_password" });
  }
  const { token, expires } = createSession();
  res.cookie("porpor_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: expires - Date.now(),
    path: "/",
  });
  res.json({ ok: true, expires });
});

app.post("/api/admin/logout", (req, res) => {
  destroySession(req.cookies?.porpor_admin);
  res.clearCookie("porpor_admin", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/admin/me", (req, res) => {
  const token = req.cookies?.porpor_admin || req.headers["x-admin-token"];
  if (!validSession(token)) return res.status(401).json({ ok: false });
  res.json({ ok: true });
});

app.get("/api/admin/stats", adminAuth, (_req, res) => {
  res.json(stats());
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
        String(o.nickname).toLowerCase().includes(q),
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
  res.json(o);
});

app.delete("/api/admin/orders/:id", adminAuth, (req, res) => {
  if (!deleteOrder(req.params.id)) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

app.get("/api/admin/settings", adminAuth, (_req, res) => {
  res.json(getSettings());
});

app.put("/api/admin/settings", adminAuth, (req, res) => {
  const body = req.body || {};
  const allowed = [
    "siteName", "taglineKm", "taglineEn", "telegram", "announcementKm", "announcementEn",
    "supportEmail", "maintenance", "coupons", "autoTopup",
  ];
  const patch = {};
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  res.json(updateSettings(patch));
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

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST, "index.html"));
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

app.listen(PORT, () => {
  console.log(`Porpor TOPUP on :${PORT}`);
  console.log(`  Khmer System payment: ${khmerSystem.isPaymentReady() ? "READY" : "NOT CONFIGURED"}`);
  console.log(`  Khmer TopUp auto:     ${khmerTopup.isTopupReady() ? "READY" : "NOT CONFIGURED"}`);
});
