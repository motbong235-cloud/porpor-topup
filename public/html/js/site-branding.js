/* Applies the logo and banners set in Admin → Settings (served by /api/settings).
   Falls back silently to the built-in logo and slides if the API is unavailable. */
(function () {
  "use strict";

  // Support widget: links come from Admin → Settings (telegram, messenger).
  // An empty or non-http(s) value hides that option; no options left hides the widget.
  function safeLink(v) {
    const u = String(v || "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }
  function applySupport(s) {
    const widget = document.querySelector(".floating-support-widget");
    if (!widget) return;
    const links = {
      telegram: safeLink(s.telegram),
      messenger: safeLink(s.messenger),
    };
    let visible = 0;
    widget.querySelectorAll("[data-support-contact]").forEach((a) => {
      const kind = a.getAttribute("data-support-contact");
      // Live Chat is built in (no link to configure) — always keep it.
      if (kind === "livechat") {
        visible += 1;
        return;
      }
      const url = links[kind];
      if (url) {
        a.href = url;
        visible += 1;
      } else {
        a.remove();
      }
    });
    if (!visible) widget.style.display = "none";
  }
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
      applySupport(s);
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
