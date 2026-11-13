/**
 * Branding: turns the logo uploaded in Admin → Settings into
 *   - the favicon shown in browser tabs AND in Google search results,
 *   - the app icon (home-screen / "Download app" icon) via a dynamic web manifest,
 *   - the iOS apple-touch-icon and the og:image used when the link is shared.
 * Uses `sharp` to resize when it is installed; otherwise serves the original image (still works, just not resized).
 * With no logo set (or on any error) it falls back to the default "PP" icons that ship with the site.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR, getSettings } from "./store.js";

let sharpMod = null;
try {
  sharpMod = (await import("sharp")).default;
} catch {
  console.warn("[branding] sharp not installed — logo will be served without resizing (run npm install)");
}

const cache = new Map(); // key -> { buf, type }
const remote = new Map(); // https url -> { buf, at }
const MAX_BYTES = 4 * 1024 * 1024;

function sniff(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Short fingerprint of the current logo — used as ?v= so browsers refresh icons when the logo changes. */
export function logoVersion() {
  const u = String(getSettings().logoUrl || "");
  if (!u) return "0";
  return crypto.createHash("sha1").update(u).digest("hex").slice(0, 8);
}

export function hasLogo() {
  return !!String(getSettings().logoUrl || "");
}

async function loadLogoBytes() {
  const url = String(getSettings().logoUrl || "");
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    const file = path.join(UPLOAD_DIR, path.basename(url));
    if (!file.startsWith(UPLOAD_DIR) || !fs.existsSync(file)) return null;
    return fs.readFileSync(file);
  }
  if (url.startsWith("https://")) {
    const hit = remote.get(url);
    if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.buf;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(url, { signal: ctl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES || !sniff(buf)) return null;
      remote.set(url, { buf, at: Date.now() });
      return buf;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Render the logo as an icon.
 * @param {number} size       output px (square)
 * @param {"any"|"maskable"|"apple"} kind
 *   any      – transparent background, tiny padding (favicon, app icon)
 *   maskable – white background + 20% safe-zone padding (Android adaptive icons)
 *   apple    – white background (iOS has no transparency), small padding
 * @returns {Promise<{buf: Buffer, type: string} | null>} null → caller should serve the default icon
 */
export async function renderLogo(size, kind = "any") {
  const v = String(getSettings().logoUrl || "");
  if (!v) return null;
  const key = `${v}|${size}|${kind}`;
  if (cache.has(key)) return cache.get(key);
  const src = await loadLogoBytes();
  if (!src) return null;
  const type = sniff(src);
  if (!type) return null;

  let out;
  if (!sharpMod) {
    out = { buf: src, type }; // no resizing available — browsers scale it themselves
  } else {
    try {
      const pad = kind === "maskable" ? 0.2 : kind === "apple" ? 0.08 : 0.04;
      const inner = Math.max(1, Math.round(size * (1 - pad * 2)));
      const bg = kind === "any" ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };
      const logo = await sharpMod(src, { animated: false })
        .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const buf = await sharpMod({ create: { width: size, height: size, channels: 4, background: bg } })
        .composite([{ input: logo, gravity: "center" }])
        .png()
        .toBuffer();
      out = { buf, type: "image/png" };
    } catch (e) {
      console.error("[branding] resize failed:", e.message);
      return null;
    }
  }
  if (cache.size > 60) cache.clear();
  cache.set(key, out);
  return out;
}

export function clearBrandingCache() {
  cache.clear();
  remote.clear();
}

/** Web app manifest (dynamic so the icon follows the admin logo). */
export function buildManifest(baseManifest) {
  const v = logoVersion();
  const q = hasLogo() ? `?v=${v}` : "";
  const icon = (size, purpose, file) => ({
    src: `/icons/${file}${q}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return {
    ...baseManifest,
    icons: [
      icon(192, "any", "app-192.png"),
      icon(512, "any", "app-512.png"),
      icon(192, "maskable", "app-maskable-192.png"),
      icon(512, "maskable", "app-maskable-512.png"),
    ],
  };
}

/** <head> tags injected into index.html: favicon, apple icon, manifest, social preview. */
export function headTags(origin) {
  const v = logoVersion();
  const q = `?v=${v}`;
  const abs = `${origin}/icons/app-512.png${q}`;
  const tags = [
    `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png${q}" />`,
    `<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-192.png${q}" />`,
    `<link rel="shortcut icon" href="/favicon.ico${q}" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png${q}" />`,
    `<link rel="manifest" href="/manifest.webmanifest${q}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="POR POR TOPUP" />`,
    `<meta property="og:image" content="${abs}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:image" content="${abs}" />`,
  ];
  return tags.join("\n    ");
}
