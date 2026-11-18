/* Applies the logo and banners set in Admin → Settings (served by /api/settings).
   Falls back silently to the built-in logo and slides if the API is unavailable. */
(function () {
  "use strict";
  fetch("/api/settings", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (!s) return;
      const logo = String(s.logoUrl || "");
      if (logo) {
        document.querySelectorAll('img[src$="porpor-logo.svg"]').forEach((img) => {
          img.src = logo;
          img.removeAttribute("srcset");
        });
        document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').forEach((l) => {
          l.href = logo;
        });
      }
      const banners = (Array.isArray(s.bannerUrls) ? s.bannerUrls : []).filter(Boolean);
      if (banners.length) {
        // Cycle the admin banners through every slide so no slide shows a broken image.
        document.querySelectorAll("img.slide-banner-image").forEach((img, i) => {
          img.src = banners[i % banners.length];
          img.removeAttribute("srcset");
        });
      }
    })
    .catch(() => {});
})();
