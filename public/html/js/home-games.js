/* Home page game list: shows the services that are open in Admin (from /api/catalog).
   Trending = games marked featured/hot in Admin. All Games = every open game. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);

  const style = document.createElement("style");
  style.textContent =
    ".pp-game-card{display:block;text-decoration:none;color:#fff7e5;background:#2d2a29;border:1px solid rgba(242,165,26,.22);border-radius:14px;overflow:hidden;min-width:0}" +
    ".pp-game-card:hover{border-color:#ffd447}" +
    ".pp-game-art{position:relative;aspect-ratio:1/1;background:#242121;display:flex;align-items:center;justify-content:center;overflow:hidden}" +
    ".pp-game-art img{width:100%;height:100%;object-fit:cover;display:block}" +
    ".pp-game-mark{font-size:28px;font-weight:800;color:#f2a51a}" +
    ".pp-game-body{padding:8px 10px 10px;min-width:0}" +
    ".pp-game-name{font-weight:700;font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".pp-game-from{font-size:11px;color:#ebd6b6;opacity:.85;margin-top:2px}" +
    ".pp-game-cta{display:block;text-align:center;margin-top:8px;padding:7px 0;border-radius:999px;font-weight:800;font-size:12px;color:#1a1412;background:linear-gradient(90deg,#f2a51a,#ffd447)}" +
    ".pp-game-badge{position:absolute;top:0;left:0;background:#f2a51a;color:#1a1412;font-size:10px;font-weight:800;font-style:italic;padding:2px 8px;border-bottom-right-radius:8px}" +
    ".pp-game-empty{grid-column:1/-1;color:#ebd6b6;text-align:center;padding:16px 0;opacity:.8}";
  document.head.appendChild(style);

  function minPrice(g) {
    const ps = (g.packs || []).filter((p) => p.inStock !== false).map((p) => Number(p.price)).filter((n) => n > 0);
    return ps.length ? Math.min(...ps) : null;
  }

  function card(g, hot) {
    const from = minPrice(g);
    const art = g.image
      ? `<img src="${esc(g.image)}" alt="" loading="lazy">`
      : `<span class="pp-game-mark">${esc(String(g.name || "?").trim().charAt(0).toUpperCase())}</span>`;
    return `<a class="pp-game-card" href="/game/${encodeURIComponent(g.id)}">
      <div class="pp-game-art">${hot ? '<span class="pp-game-badge">TOP</span>' : ""}${art}</div>
      <div class="pp-game-body">
        <div class="pp-game-name" title="${esc(g.name)}">${esc(g.name)}</div>
        ${from != null ? `<div class="pp-game-from">From ${money(from)}</div>` : ""}
        <span class="pp-game-cta">TOP UP</span>
      </div></a>`;
  }

  function fill(section, games, hot, countLabel) {
    const grid = section && section.querySelector("[data-catalog-grid]");
    if (!grid) return;
    grid.innerHTML = games.length
      ? games.map((g) => card(g, hot)).join("")
      : `<div class="pp-game-empty">No games available</div>`;
    // The count badge sits in the header block just before this section.
    let el = section.previousElementSibling;
    let label = null;
    while (el && !label) {
      label = el.matches("span.font-semibold") ? el : el.querySelector("span.font-semibold");
      el = el.previousElementSibling;
    }
    if (!label && section.parentElement) {
      let up = section.parentElement.previousElementSibling;
      while (up && !label) {
        label = up.matches("span.font-semibold") ? up : up.querySelector("span.font-semibold");
        up = up.previousElementSibling;
      }
    }
    if (label) label.textContent = games.length + " " + countLabel;
  }

  fetch("/api/catalog", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !Array.isArray(d.games)) return;
      const open = d.games.filter((g) => g.open !== false);
      const trending = open.filter((g) => g.hot || g.famous || g.featured);
      fill(document.querySelector('[data-catalog-section="trending"]'), trending, true, "items");
      fill(document.querySelector('[data-catalog-section="all"]'), open, false, "games");
    })
    .catch(() => {});
})();
