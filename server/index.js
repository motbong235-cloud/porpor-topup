import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import {
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

  const packageId =
    order.ktPackageId ||
    (settings.packageMap && settings.packageMap[order.packId]) ||
    null;

  if (!packageId) {
    return updateOrder(order.id, {
      status: "paid",
      note: "No packageMap for this pack — set in Admin → Settings",
    });
  }

  try {
    updateOrder(order.id, { status: "processing" });
    const result = await khmerTopup.placeOrder({
      packageId,
      playerId: order.userId,
      serverId: order.zoneId || order.server || undefined,
      reference: order.id,
    });
    return updateOrder(order.id, {
      status: result.status === "completed" ? "delivered" : "processing",
      ktOrderCode: result.order_code,
      ktStatus: result.status,
      note: `Khmer TopUp ${result.order_code}`,
    });
  } catch (e) {
    return updateOrder(order.id, {
      status: "failed",
      note: `TopUp error: ${e.message}`,
    });
  }
}

async function pollKtStatus(order) {
  if (!order.ktOrderCode || !khmerTopup.isTopupReady()) return order;
  try {
    const remote = await khmerTopup.getOrder(order.ktOrderCode);
    const st = String(remote.status || "").toLowerCase();
    if (st === "completed") {
      return updateOrder(order.id, { status: "delivered", ktStatus: st });
    }
    if (st === "refunded") {
      return updateOrder(order.id, { status: "failed", ktStatus: st, note: "Supplier refunded" });
    }
    return updateOrder(order.id, { ktStatus: st });
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
    allowDemoPay: s.allowDemoPay !== false,
    simulation: !khmerSystem.isPaymentReady(),
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
    closedGames: s.closedGames || [],
    coupons: (s.coupons || []).map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      min: c.min,
    })),
  });
});

app.post("/api/verify", async (req, res) => {
  const { slug, playerId, serverId } = req.body || {};
  if (!playerId) return res.status(400).json({ result: "incomplete", message: "playerId required" });

  if (khmerTopup.isTopupReady() && slug) {
    try {
      const data = await khmerTopup.verifyAccount(slug, playerId, serverId);
      return res.json(data);
    } catch (e) {
      return res.json({ result: "unknown", error: e.message });
    }
  }

  const NICKS = ["Porpor", "Neary", "DaraKH", "Sokha", "BlueFox", "Vimean", "NightOwl", "LinaPP"];
  let h = 0;
  for (const c of String(playerId)) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  res.json({
    result: "valid",
    nickname: `${NICKS[h % NICKS.length]}${(h % 80) + 11}`,
    local: true,
  });
});

app.post("/api/checkout/create", async (req, res) => {
  const body = req.body || {};
  const settings = getSettings();
  if (settings.maintenance) {
    return res.status(503).json({ error: "maintenance" });
  }
  if (!body.gameId || !body.userId || !body.packName || !(Number(body.total) > 0)) {
    return res.status(400).json({ error: "invalid" });
  }

  const id = body.id || newCode();
  const packId = String(body.packId || "");
  const ktPackageId =
    body.ktPackageId ||
    (settings.packageMap && settings.packageMap[packId]) ||
    null;

  const order = createOrder({
    id,
    gameId: String(body.gameId),
    gameName: String(body.gameName || body.gameId),
    packId,
    packName: String(body.packName),
    qty: Math.min(10, Math.max(1, Number(body.qty) || 1)),
    total: Math.max(0, Number(body.total) || 0),
    discount: Math.max(0, Number(body.discount) || 0),
    userId: String(body.userId),
    zoneId: String(body.zoneId || ""),
    server: String(body.server || ""),
    nickname: String(body.nickname || ""),
    method: body.method === "wallet" ? "wallet" : "khqr",
    coupon: String(body.coupon || ""),
    ktPackageId: ktPackageId ? Number(ktPackageId) : null,
    status: "pending",
    createdAt: Date.now(),
  });

  if (order.method === "wallet") {
    const paid = updateOrder(order.id, { status: "paid", paidAt: Date.now() });
    const done = await fulfillTopup(paid);
    return res.json({ order: done, payment: { mode: "wallet" } });
  }

  if (khmerSystem.isPaymentReady()) {
    const qr = await khmerSystem.createQr(order.total, order.id, `${order.gameName} ${order.packName}`);
    if (!qr.success) {
      updateOrder(order.id, { status: "failed", note: qr.error });
      return res.status(502).json({ error: qr.error || "qr_failed", order });
    }
    const updated = updateOrder(order.id, {
      transactionId: qr.transaction_id,
      qrImage: qr.qr_image,
      qrString: qr.qr_string,
    });
    return res.json({
      order: updated,
      payment: {
        mode: "live",
        transactionId: qr.transaction_id,
        qrImage: qr.qr_image,
        qrString: qr.qr_string,
      },
    });
  }

  if (settings.allowDemoPay === false) {
    updateOrder(order.id, { status: "failed", note: "Payment not configured" });
    return res.status(503).json({ error: "payment_not_configured", order });
  }

  const simTx = `SIM-${order.id}`;
  const updated = updateOrder(order.id, { transactionId: simTx, simulation: true });
  return res.json({
    order: updated,
    payment: {
      mode: "simulation",
      transactionId: simTx,
      message: "Demo QR — confirm to simulate payment (set ABA_API_KEY for live)",
    },
  });
});

app.get("/api/checkout/:id/status", async (req, res) => {
  let order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });

  if (
    order.status === "pending" &&
    order.transactionId &&
    !order.simulation &&
    khmerSystem.isPaymentReady()
  ) {
    const pay = await khmerSystem.checkPayment(order.transactionId);
    if (pay.paid) {
      order = updateOrder(order.id, { status: "paid", paidAt: Date.now() });
      order = await fulfillTopup(order);
    }
  }

  if (order.status === "processing" && order.ktOrderCode) {
    order = await pollKtStatus(order);
  }

  res.json({ order });
});

app.post("/api/checkout/:id/demo-confirm", async (req, res) => {
  const settings = getSettings();
  let order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });
  if (order.status !== "pending") return res.json({ order });

  if (!order.simulation && khmerSystem.isPaymentReady()) {
    return res.status(400).json({ error: "use_live_poll" });
  }
  if (settings.allowDemoPay === false) {
    return res.status(403).json({ error: "demo_disabled" });
  }

  order = updateOrder(order.id, { status: "paid", paidAt: Date.now(), note: "demo payment" });
  order = await fulfillTopup(order);
  res.json({ order });
});

app.get("/api/orders/track", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  const hits = listOrders().filter(
    (o) =>
      o.id.toLowerCase() === q ||
      o.id.toLowerCase().includes(q) ||
      String(o.userId).toLowerCase() === q,
  );
  res.json(hits.slice(0, 20));
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  if (!body.gameId || !body.userId || !body.packName) {
    return res.status(400).json({ error: "invalid" });
  }
  const order = {
    id: body.id || newCode(),
    gameId: String(body.gameId),
    gameName: String(body.gameName || body.gameId),
    packName: String(body.packName),
    qty: Math.min(10, Math.max(1, Number(body.qty) || 1)),
    total: Math.max(0, Number(body.total) || 0),
    discount: Math.max(0, Number(body.discount) || 0),
    userId: String(body.userId),
    zoneId: String(body.zoneId || ""),
    server: String(body.server || ""),
    nickname: String(body.nickname || ""),
    method: body.method === "wallet" ? "wallet" : "khqr",
    coupon: String(body.coupon || ""),
    status: body.status || "delivered",
    createdAt: Date.now(),
  };
  createOrder(order);
  res.json(order);
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
  let o = updateOrder(req.params.id, {
    status: req.body?.status,
    note: req.body?.note,
  });
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
    "supportEmail", "defaultWallet", "maintenance", "coupons", "closedGames",
    "packageMap", "autoTopup", "allowDemoPay",
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

app.get("/api/admin/kt-games", adminAuth, async (_req, res) => {
  if (!khmerTopup.isTopupReady()) {
    return res.status(503).json({ error: "KHMER_TOPUP_API_KEY not set" });
  }
  try {
    res.json(await khmerTopup.listGames());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
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

app.listen(PORT, () => {
  console.log(`Porpor TOPUP on :${PORT}`);
  console.log(`  Khmer System payment: ${khmerSystem.isPaymentReady() ? "READY" : "off (demo)"}`);
  console.log(`  Khmer TopUp auto:     ${khmerTopup.isTopupReady() ? "READY" : "off"}`);
});
