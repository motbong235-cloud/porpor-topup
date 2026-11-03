/**
 * Double-submit CSRF: cookie porpor_csrf + header X-CSRF-Token must match.
 */
import crypto from "crypto";

export function issueCsrf(res, isProd) {
  const token = crypto.randomBytes(24).toString("hex");
  res.cookie("porpor_csrf", token, {
    httpOnly: false, // readable by JS for header
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfGuard(req, res, next) {
  // Safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // Only enforce on admin mutating routes (and checkout)
  const path = req.path || "";
  const need =
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/checkout/");
  if (!need) return next();
  // login bootstraps session — skip CSRF on login itself
  if (path === "/api/admin/login") return next();
  const cookie = String(req.cookies?.porpor_csrf || "");
  const header = String(req.headers["x-csrf-token"] || "");
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ error: "csrf" });
  }
  next();
}
