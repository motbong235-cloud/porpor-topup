/** Ensure HTML storefront routes exist; do not create /game→/html loops. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "server", "index.js");
let t = fs.readFileSync(file, "utf8");
if (t.includes("sendHtml") && t.includes("HTML_SITE")) {
  console.log("[html] storefront routes already present");
  process.exit(0);
}
console.log("[html] WARNING: HTML storefront routes missing — check server/index.js");
