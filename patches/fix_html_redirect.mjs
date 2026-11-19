import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "index.js");
let t = fs.readFileSync(file, "utf8");
if (t.includes("Legacy static path: never expose /html")) {
  console.log("[html-redirect] already present");
  process.exit(0);
}
const needle = "if (fs.existsSync(DIST)) {";
const inject = `// Legacy static path: never expose /html/index.html — send users to clean root
app.get(["/html", "/html/", "/html/index.html"], (_req, res) => {
  res.redirect(301, "/");
});
app.get(/^\\/html\\/.+/, (_req, res) => {
  res.redirect(301, "/");
});

`;
if (!t.includes(needle)) {
  console.error("[html-redirect] DIST block not found");
  process.exit(1);
}
fs.writeFileSync(file, t.replace(needle, inject + needle));
console.log("[html-redirect] applied");
