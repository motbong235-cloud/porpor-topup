import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "index.js");
let t = fs.readFileSync(file, "utf8");

const MARKER = "Legacy static path: never expose /html";

const BLOCK = `// Legacy static path: never expose /html/index.html — clean React routes only
// /html/game.html?id=telegram  →  /game/telegram
// /html/index.html             →  /
app.get(["/html", "/html/", "/html/index.html"], (_req, res) => {
  res.redirect(301, "/");
});
app.get("/html/game.html", (req, res) => {
  const id = String(req.query.id || req.query.game || "").trim();
  if (id) return res.redirect(301, "/game/" + encodeURIComponent(id));
  return res.redirect(301, "/");
});
app.get(/^\\/html\\/.+/, (req, res) => {
  const base = String(req.path || "").replace(/^\\/html\\//, "").replace(/\\.html$/i, "");
  if (base && base !== "index") {
    return res.redirect(301, "/game/" + encodeURIComponent(base));
  }
  return res.redirect(301, "/");
});

`;

if (t.includes("app.get(\"/html/game.html\"")) {
  console.log("[html-redirect] game.html map already present");
  process.exit(0);
}

if (t.includes(MARKER)) {
  const start = t.indexOf("// Legacy static path:");
  const end = t.indexOf("if (fs.existsSync(DIST))", start);
  if (start >= 0 && end > start) {
    t = t.slice(0, start) + t.slice(end);
    console.log("[html-redirect] removed old block");
  }
}

const needle = "if (fs.existsSync(DIST)) {";
if (!t.includes(needle)) {
  console.error("[html-redirect] DIST block not found");
  process.exit(1);
}
t = t.replace(needle, BLOCK + needle);
fs.writeFileSync(file, t);
console.log("[html-redirect] applied with game.html → /game/:id");
