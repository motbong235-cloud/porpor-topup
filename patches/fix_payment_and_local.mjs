/**
 * Build-time: unify payment for local+API services; tag local provider.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexFile = path.join(root, "server", "index.js");
const localFile = path.join(root, "server", "localProducts.js");
const catFile = path.join(root, "server", "catalog.js");

function patchIndex() {
  let t = fs.readFileSync(indexFile, "utf8");
  if (t.includes("Payment: try RielPay (settings → env) then Khmer System ABA")) {
    console.log("[fix_pay] index already patched");
    return;
  }

  const oldGate = `  if (!rielPay.isReady("settings") && !rielPay.isReady("env") && !khmerSystemPay.isPaymentReady()) {
    return res.status(503).json({
      error: "not_configured",
      detail: "No payment key — TikTok needs Admin Settings ABA PayWay key; other services need RIELPAY_API_KEY on Render",
    });
  }`;
  const newGate = `  // Any configured gateway is enough (local + API services share the same KHQR)
  if (!rielPay.isReady("settings") && !rielPay.isReady("env") && !rielPay.isReady("auto") && !khmerSystemPay.isPaymentReady()) {
    return res.status(503).json({
      error: "not_configured",
      detail: "No payment key — set ABA_API_KEY + ABA_MERCHANT_ID or RIELPAY_API_KEY (Admin Settings or Render env)",
    });
  }`;
  if (t.includes(oldGate)) {
    t = t.replace(oldGate, newGate);
    console.log("[fix_pay] gate");
  } else {
    console.log("[fix_pay] gate miss (maybe already fixed)");
  }

  const oldQr = `  // Payment keys:\n  // - TikTok Khmer (kaiRoute) → Admin Settings rielpayApiKey\n  // - Other services → Render env RIELPAY_API_KEY\n  let qr;\n  let usedGateway;\n  const keySource = kaiRoute ? "settings" : "env";\n  if (rielPay.isReady(keySource)) {\n    qr = await rielPay.createPayment(\n      order.total,\n      order.id,\n      \`\${order.gameName || "Topup"} \${order.packName || ""}\`.trim() || \`Order \${order.id}\`,\n      { keySource },\n    );\n    usedGateway = "rielpay";\n    if (!qr.success) {\n      console.error("[checkout] ABA PayWay QR failed:", keySource, qr.error, JSON.stringify(qr.raw || {}));\n      if (kaiRoute) {\n        updateOrder(order.id, { status: "failed", note: \`QR error (settings key): \${qr.error}\` });\n        return res.status(502).json({\n          error: "qr_failed",\n          detail: qr.error,\n          code: qr.code || "",\n          gateway: "aba_payway",\n          keySource,\n        });\n      }\n    }\n  } else if (kaiRoute) {\n    console.error("[checkout] TikTok Khmer: no Admin Settings ABA PayWay key");\n    updateOrder(order.id, { status: "failed", note: "QR error: missing settings API key" });\n    return res.status(502).json({\n      error: "qr_failed",\n      detail: "TikTok Khmer requires ABA PayWay API Key in Admin Settings",\n      gateway: "aba_payway",\n      keySource: "settings",\n    });\n  }\n  if ((!qr || !qr.success) && khmerSystemPay.isPaymentReady() && !kaiRoute) {\n    const uname = String(order.userId || order.id).replace(/^@/, "").slice(0, 24);\n    qr = await khmerSystemPay.createQr(order.total, order.id, uname);\n    usedGateway = "aba";\n  }`;

  const newQr = `  // Payment: try RielPay (settings → env) then Khmer System ABA — works for local + API services\n  let qr;\n  let usedGateway;\n  for (const keySource of ["settings", "env", "auto"]) {\n    if (!rielPay.isReady(keySource)) continue;\n    qr = await rielPay.createPayment(\n      order.total,\n      order.id,\n      \`\${order.gameName || "Topup"} \${order.packName || ""}\`.trim() || \`Order \${order.id}\`,\n      { keySource },\n    );\n    usedGateway = "rielpay:" + keySource;\n    if (qr && qr.success) break;\n    console.error("[checkout] RielPay QR failed:", keySource, qr && qr.error, JSON.stringify((qr && qr.raw) || {}));\n    qr = null;\n  }\n  if ((!qr || !qr.success) && khmerSystemPay.isPaymentReady()) {\n    const uname = String(order.userId || order.id).replace(/^@/, "").slice(0, 24);\n    qr = await khmerSystemPay.createQr(order.total, order.id, uname);\n    usedGateway = "aba";\n  }`;

  if (t.includes("Payment keys:")) {
    // softer replace via markers
    const start = t.indexOf("  // Payment keys:");
    const end = t.indexOf("  if (!qr || !qr.success)");
    if (start >= 0 && end > start) {
      t = t.slice(0, start) + newQr + "\n" + t.slice(end);
      console.log("[fix_pay] qr cascade (slice)");
    } else {
      console.log("[fix_pay] qr markers miss");
    }
  }

  fs.writeFileSync(indexFile, t);
}

function patchLocal() {
  let t = fs.readFileSync(localFile, "utf8");
  if (!t.includes('provider: "local"') && t.includes("open: g.open !== false,")) {
    t = t.replace("open: g.open !== false,", 'open: g.open !== false,\n        provider: "local",');
    fs.writeFileSync(localFile, t);
    console.log("[fix_pay] local provider tag");
  } else {
    console.log("[fix_pay] local ok");
  }
}

function patchCatalog() {
  let t = fs.readFileSync(catFile, "utf8");
  const old = `  const local = localCatalog()\n    .filter((g) => g.open !== false || g.showWhenOff)\n    .map((g) => ({\n      ...g,\n      packs: g.packs.map(({ cost, ...p }) => p),\n    }));`;
  const neu = `  let local = localCatalog()\n    .filter((g) => g.open !== false || g.showWhenOff)\n    .map((g) => ({\n      ...g,\n      packs: (Array.isArray(g.packs) ? g.packs : []).map(({ cost, ...p }) => p),\n      provider: g.provider || "local",\n    }));`;
  if (t.includes(old)) {
    t = t.replace(old, neu);
    fs.writeFileSync(catFile, t);
    console.log("[fix_pay] catalog local");
  } else {
    console.log("[fix_pay] catalog ok/miss");
  }
}

patchIndex();
patchLocal();
patchCatalog();
console.log("[fix_pay] done");
