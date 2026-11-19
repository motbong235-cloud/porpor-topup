/** Remove legacy static /html storefront redirects that loop with React routes. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "index.js");
let t = fs.readFileSync(file, "utf8");

const START = "  // ---- Static HTML storefront (public/html → dist/html) ----";
const END = "  app.get(\"*\", (req, res, next) => {";

if (t.includes(START)) {
  const a = t.indexOf(START);
  const b = t.indexOf(END, a);
  if (a >= 0 && b > a) {
    t = t.slice(0, a) + t.slice(b);
    console.log("[html-redirect] removed static HTML storefront block");
  }
}

const MARKER = "/* PORPOR_CLEAN_URL_REDIRECTS */";
if (!t.includes(MARKER)) {
  const needle = "if (fs.existsSync(DIST)) {";
  const block = `${MARKER}
app.get(["/html", "/html/", "/html/index.html"], (_req, res) => {
  res.redirect(301, "/");
});
app.get("/html/game.html", (req, res) => {
  const id = String(req.query.id || req.query.game || "").trim();
  if (id) return res.redirect(301, "/game/" + encodeURIComponent(id));
  return res.redirect(301, "/");
});
app.get("/html/login.html", (_req, res) => res.redirect(301, "/"));
app.get(/^\\/html\\/.+\\.html$/i, (req, res) => {
  const base = String(req.path || "").replace(/^\\/html\\//, "").replace(/\\.html$/i, "");
  if (base && base !== "index" && base !== "login") {
    return res.redirect(301, "/game/" + encodeURIComponent(base));
  }
  return res.redirect(301, "/");
});

`;
  if (t.includes(needle)) {
    t = t.replace(needle, block + needle);
    console.log("[html-redirect] installed clean one-way redirects");
  }
} else {
  console.log("[html-redirect] already present");
}

fs.writeFileSync(file, t);
console.log("[html-redirect] done");
