/* Generic game top-up page, styled with the reference checkout CSS
   (checkout-payment__*, game-checkout-layout, storefront theme).
   Fields come from the admin-set catalog: idHintEn/idHintKm, numericId,
   hasZone (+ zone label), servers [{value,label}], packs[] grouped by category. */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const root = $("#game-root");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  const gameId = (() => {
    const q = new URLSearchParams(location.search).get("id") || "";
    if (q) return q;
    const m = location.pathname.match(/^\/games?\/([^/]+)/i);
    return m ? decodeURIComponent(m[1]) : "";
  })();

  const S = {
    game: null, error: "", check: null, checkMsg: "", pack: null, qty: 1,
    userId: "", zoneId: "", server: "", coupon: "", discount: 0, couponMsg: "",
    agreed: false, payErr: "", paying: false, checkoutId: null, timer: null, csrf: "",
  };

  function toast(text) {
    const el = $("#gp-toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  async function api(path, opts = {}) {
    try {
      const res = await fetch(path, { credentials: "same-origin", ...opts });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: "network" } };
    }
  }

  async function csrfToken() {
    if (S.csrf) return S.csrf;
    const r = await api("/api/csrf");
    S.csrf = r.data.csrf || "";
    return S.csrf;
  }

  const hasZone = () => !!S.game.hasZone;
  const hasServer = () => Array.isArray(S.game.servers) && S.game.servers.length > 0;
  const subtotal = () => (S.pack ? Number(S.pack.price) * S.qty : 0);
  const total = () => Math.max(0, subtotal() - S.discount);
  const isTT = () => /tiktok/i.test(String(S.game.id) + " " + String(S.game.name));
  const idLabel = () => (isTT() ? "TikTok video link" : S.game.numericId ? "User ID" : "Player ID");
  const idHint = () => S.game.idHintEn || S.game.idHintKm || "";
  const zoneLabel = () => S.game.zoneLabelEn || S.game.zoneLabelKm || "Zone ID";

  /* ---------- render ---------- */
  const ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c.4 0 .8.2 1 .6l2 4.1 4.5.7c.9.1 1.2 1.2.6 1.8l-3.3 3.2.8 4.5c.2.9-.8 1.6-1.6 1.1L12 16.7l-4 2.1c-.8.4-1.700-.2-1.600-1.100l.8-4.500-3.300-3.200c-.6-.6-.3-1.700.6-1.800l4.500-.7 2-4.100c.2-.4.600-.6 1-.6z"/></svg>';
  const ICON_BAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 8V7a4.5 4.5 0 019 0v1h1.700c.9 0 1.600.7 1.700 1.600l.8 9.100c.1 1.200-.8 2.300-2 2.300H5.300c-1.200 0-2.100-1.100-2-2.300l.8-9.100C4.200 8.700 4.900 8 5.800 8h1.700zm2 0h5V7a2.500 2.500 0 00-5 0v1z"/></svg>';

  const ICON_COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="pkc" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="1" stop-color="#F29A1B"/></linearGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#pkc)"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B8650A" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7v10M14.400 9.400c-.4-.8-1.300-1.200-2.400-1.200-1.400 0-2.400.7-2.400 1.800 0 2.400 5 1 5 3.600 0 1.100-1.100 1.800-2.600 1.800-1.200 0-2.200-.5-2.600-1.400" fill="none" stroke="#7A3F00" stroke-width="1.500" stroke-linecap="round"/></svg>';
  const ICON_THUMB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.500 10.500c0-.6.4-1 1-1H7v11H3.500a1 1 0 01-1-1v-9zM8.500 9.800l3-6.400c.2-.5.700-.8 1.200-.8 1.300 0 2.300 1.200 2 2.500L14.100 8h4.900c1.300 0 2.300 1.200 2 2.500l-1.400 7.500c-.3 1.400-1.500 2.400-2.900 2.400H9.500c-.6 0-1-.4-1-1V9.800z"/></svg>';
  const ICON_TAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.100 2.600l1.600 4.500 4.500 1.600c.9.300.9 1.600 0 1.900l-4.500 1.600-1.600 4.500c-.3.900-1.600.9-1.900 0l-1.600-4.500-4.500-1.600c-.9-.3-.9-1.600 0-1.900l4.500-1.600 1.600-4.500c.3-.9 1.600-.9 1.900 0zM19 15l.8 2.200 2.200.8-2.200.8L19 21l-.8-2.200-2.200-.8 2.200-.8L19 15z"/></svg>';

  /* "1" -> "+1 Coin"; anything else is shown as typed (e.g. "+5 Bonus") */
  function bonusText(b) {
    const t = String(b == null ? "" : b).trim();
    if (!t) return "";
    return /^\+?\d+(\.\d+)?$/.test(t) ? "+" + t.replace(/^\+/, "") + " Coin" : t;
  }

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4 6v6c0 4.6 3.2 8 8 9.500 4.800-1.500 8-4.900 8-9.500V6l-8-3.500zm-1.200 13.200-3.100-3.100 1.300-1.300 1.800 1.800 4.200-4.200 1.300 1.300-5.500 5.500z"/></svg>';
  const ICON_BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6.500L9.500 22 20 9.500h-6.700z"/></svg>';
  const ICON_HEAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v5a3 3 0 0 0 3 3h1v-7H6v-1a6 6 0 0 1 12 0v1h-2v7h1.500a2.500 2.500 0 0 1-2.500 2h-2.500v2H14a4.500 4.500 0 0 0 4.500-4.500V19A3 3 0 0 0 20 16v-5a8 8 0 0 0-8-8z"/></svg>';
  const ICON_USER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>';

  /* Package cards — Kira Store style: art + price + name + HOT/FEATURED ribbon */
  function packHero(p) {
    const name = String(p.name || "");
    // e.g. "50 Stars", "Weekly x3" → big number/token
    const m = name.match(/(\d[\d.,]*)\s*(stars?|diamond|gem|uc|robux|coin)?/i);
    if (p.image) {
      return `<img class="kira-art-img" src="${esc(p.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.hidden=false)"><span class="kira-art-num" hidden>${esc(m ? m[1] : name.slice(0, 3))}</span>`;
    }
    if (m) return `<span class="kira-art-num">${esc(m[1])}</span>`;
    return `<span class="kira-art-num kira-art-letter">${esc(name.charAt(0) || "?")}</span>`;
  }
  function packOption(p, idx) {
    const sel = S.pack && String(S.pack.id) === String(p.id);
    const oos = p.inStock === false;
    const bonus = bonusText(p.bonus);
    let tag = String(p.tag || "").trim().toUpperCase();
    if (!tag && (p.hot || p.famous)) tag = "HOT";
    if (!tag && p.featured) tag = "FEATURED";
    // Visual rhythm like Kira when supplier has no tags
    if (!tag && typeof idx === "number" && idx % 3 === 0) tag = "FEATURED";
    if (!tag && typeof idx === "number" && idx % 5 === 0) tag = "HOT";
    return `<button type="button" class="pk-item kira-pack${sel ? " is-selected" : ""}${oos ? " is-oos" : ""}${tag ? " has-tag" : ""}" role="radio" aria-checked="${!!sel}" data-selected="${!!sel}" data-pack="${esc(p.id)}" ${oos ? "disabled" : ""}>
      ${bonus ? `<span class="pk-coin">${esc(bonus)}</span>` : ""}
      <span class="kira-art">${packHero(p)}</span>
      <span class="kira-meta">
        <span class="kira-price">${oos ? "Out of stock" : money(p.price)}</span>
        <span class="kira-name">${esc(p.name)}</span>
      </span>
      ${tag ? `<span class="kira-badge ${tag === "HOT" ? "is-hot" : "is-feat"}">${esc(tag)}</span>` : ""}
    </button>`;
  }

  /* 👍 likes: one vote per visitor (remembered here + de-duplicated on the server) */
  function likedSet() { try { return new Set(JSON.parse(localStorage.getItem("pp_liked") || "[]")); } catch { return new Set(); } }
  function liked() { return !!(S.game && likedSet().has(String(S.game.id))); }
  function likeCount() { return Math.max(0, Number(S.likes && S.likes[S.game.id]) || 0) + 0; }
  async function toggleLike() {
    const id = String(S.game.id), set = likedSet(), on = !set.has(id);
    if (on) set.add(id); else set.delete(id);
    try { localStorage.setItem("pp_liked", JSON.stringify([...set])); } catch {}
    S.likes = S.likes || {};
    S.likes[id] = Math.max(0, (Number(S.likes[id]) || 0) + (on ? 1 : -1));
    try { navigator.vibrate && navigator.vibrate(on ? 15 : 6); } catch {}
    render();
    const r = await api("/api/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: id, on }) });
    if (r.data && typeof r.data.count === "number") { S.likes[id] = r.data.count; render(); }
  }

  function packGroups() {
    const groups = new Map();
    (S.game.packs || []).forEach((p) => {
      const key = p.category || "Packages";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    const cats = [...groups.keys()];
    const chips = cats.length > 1
      ? `<div class="pk-chips" role="tablist">${cats.map((c, i) => `<button type="button" class="pk-chip" data-jump="pkg-${i}">${esc(c)}<b>${groups.get(c).length}</b></button>`).join("")}</div>`
      : "";
    return chips + [...groups.entries()].map(([cat, list], gi) => `
      <div class="pk-group" id="pkg-${gi}">
        <div class="pk-head">
          <span class="pk-head__title">${ICON_STAR}${esc(cat)}</span>
          <button type="button" class="pk-head__count pk-like${liked() ? " is-liked" : ""}" data-like aria-pressed="${liked()}" aria-label="Like">${ICON_THUMB}<span class="pk-like__n">${likeCount()}</span></button>
        </div>
        <div class="pk-grid" role="radiogroup">${list.map((p, i) => packOption(p, i)).join("")}</div>
      </div>`).join("");
  }

  function render() {
    const y = window.scrollY;
    const ae = document.activeElement;
    const keepId = ae && ae.id && root.contains(ae) ? ae.id : null;
    const caret = keepId && typeof ae.selectionStart === "number" ? ae.selectionStart : null;
    paint();
    window.scrollTo(0, y);
    if (keepId) {
      const el = document.getElementById(keepId);
      if (el && el.tagName !== "BUTTON") { try { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange(caret, caret); } catch {} }
    }
  }

  function paint() {
    const g = S.game;
    if (!g) {
      root.innerHTML = `<section class="checkout-card"><p>${esc(S.error || "Game not found.")}</p><a class="checkout-btn" href="/">Back to home</a></section>`;
      return;
    }
    const open = g.open !== false;
    const hint = idHint();
    const bn = (g.banners && g.banners[0]) || g.banner || "";
    root.innerHTML = `
      ${open ? `
      <div class="game-checkout-layout kg-layout">
        <div class="game-checkout-sidebar kg-grid">
          <section class="checkout-card kg-packs" data-checkout-products-section>
            <h2 class="checkout-card__title">Choose package</h2>
            ${packGroups() || `<p class="checkout-help">No packages available.</p>`}
            <div class="checkout-quantity">
              <span class="checkout-quantity__label">Quantity</span>
              <div class="checkout-quantity__stepper">
                <button type="button" class="checkout-quantity__button" data-qty="-1" aria-label="Less">−</button>
                <span class="checkout-quantity__value" aria-live="polite">${S.qty}</span>
                <button type="button" class="checkout-quantity__button" data-qty="1" aria-label="More">+</button>
              </div>
            </div>
            <div class="checkout-row checkout-coupon" data-coupon-panel>
              <input id="f-coupon" class="checkout-input" value="${esc(S.coupon)}" placeholder="Coupon code" autocomplete="off">
              <button type="button" class="checkout-btn checkout-btn--ghost" id="btn-coupon" data-coupon-apply>Apply</button>
            </div>
            <p class="checkout-help ${S.couponMsg.startsWith("✓") ? "is-ok" : "is-err"}" data-coupon-status>${esc(S.couponMsg)}</p>
          </section>
          <aside class="kg-side">
            <div class="kg-banner">${bn ? `<img src="${esc(bn)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('is-empty');this.remove()">` : ""}<div class="kg-banner__fb"><b>${esc(g.name)}</b><span>Top up instantly · Secure KHQR</span></div></div>
          <section class="checkout-card kg-game" data-checkout-player-section>
            <div class="kg-ghead">
              <div class="kg-gicon">${g.image ? `<img src="${esc(g.image)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.visibility='hidden'">` : `<span>${esc(String(g.name || "?").charAt(0))}</span>`}</div>
              <div class="kg-gmeta"><h1 class="kg-gtitle">${esc(g.name)}</h1>
                <div class="kg-chips">${open ? `<span class="kg-chip is-ver">${ICON_CHECK}Verified</span><span class="kg-chip is-inst">${ICON_BOLT}Instant</span><span class="kg-chip is-247">${ICON_HEAD}24/7</span>` : `<span class="kg-chip">Currently unavailable</span>`}</div>
              </div>
            </div>
            <div class="kg-pd"><span class="kg-pd__ico">${ICON_USER}</span><div><b>Player details</b><small>${esc(hint || "Enter account ID & server")}</small></div></div>
            <div class="checkout-field">
              <div class="checkout-row">
                <input id="f-user" class="checkout-input" value="${esc(S.userId)}" autocomplete="off" ${g.numericId ? 'inputmode="numeric"' : ""} placeholder="${esc(hint || idLabel())}">
                <button type="button" class="checkout-btn checkout-btn--ghost" id="btn-check">${isTT() ? "Check link" : "Check ID"}</button>
              </div>
                            <p class="checkout-help ${S.check ? "is-ok" : S.checkSoft ? "is-soft" : "is-err"}" id="check-msg">${S.check ? "✓ " + esc(S.check.nickname) : esc(S.checkMsg)}</p>
            </div>
            ${hasZone() ? `<div class="checkout-field">
              <label class="checkout-label" for="f-zone">${esc(zoneLabel())}</label>
              <input id="f-zone" class="checkout-input" value="${esc(S.zoneId)}" autocomplete="off" inputmode="numeric">
            </div>` : ""}
            ${hasServer() ? `<div class="checkout-field">
              <label class="checkout-label" for="f-server">Server</label>
              <select id="f-server" class="checkout-input">
                <option value="">Select server</option>
                ${g.servers.map((s) => `<option value="${esc(s.value)}" ${String(S.server) === String(s.value) ? "selected" : ""}>${esc(s.label || s.value)}</option>`).join("")}
              </select>
            </div>` : ""}
          </section>
          <section class="checkout-card checkout-payment" data-checkout-payment-section>
            <div class="checkout-payment__heading">
              <div><h3>Payment method</h3><p>Pay with ABA KHQR</p></div>
              <span class="checkout-payment__secure">Secure</span>
            </div>
            <div class="checkout-payment__options" role="radiogroup">
              <button type="button" class="checkout-payment__option" role="radio" aria-checked="true" data-selected="true">
                <span class="checkout-payment__icon checkout-payment__icon--aba"><img src="payments/aba-logo-plain.png" alt="ABA"></span>
                <span class="checkout-payment__copy">
                  <span class="checkout-payment__name">ABA PayWay</span>
                  <span class="checkout-payment__description">Scan the KHQR with the ABA app to pay the full amount.</span>
                </span>
              </button>
            </div>
            <label class="checkout-payment__terms">
              <input type="checkbox" id="f-agree" class="checkout-payment__terms-checkbox" ${S.agreed ? "checked" : ""}>
              <span>I agree to the <a href="index.html#terms">Terms</a> and confirm the account details are correct.</span>
            </label>
            <div class="checkout-summary" data-coupon-summary>
              <div class="checkout-summary__line"><span>${S.pack ? esc(S.pack.name) + " × " + S.qty : "Select a package"}</span><span>${money(subtotal())}</span></div>
              <div class="checkout-summary__line"><span>Coupon</span><span>−${money(S.discount)}</span></div>
              <div class="checkout-summary__total"><span>Total</span><span data-discounted="${S.discount > 0}">${money(total())}</span></div>
            </div>
            <p class="checkout-help is-err" id="pay-err">${esc(S.payErr)}</p>
            <button type="button" class="checkout-btn checkout-btn--pay" id="btn-pay" ${S.paying || !S.pack ? "disabled" : ""}>
              ${S.paying ? "Please wait…" : S.pack ? "Pay " + money(total()) : "Select a package"}
            </button>
          </section>
          </aside>
        </div>
        <div class="pk-bar">
          <div class="pk-bar__info">
            <span class="pk-bar__sel">${S.pack ? esc(S.pack.name) + (S.qty > 1 ? " × " + S.qty : "") : "Select a package"}</span>
            <div class="pk-bar__total"><span>Total:</span><strong class="${S.bump ? "is-bump" : ""}">${money(total())}</strong></div>
          </div>
          <button type="button" class="pk-bar__pay" id="btn-pay-bar" ${S.paying || !S.pack ? "disabled" : ""}>${ICON_BAG}${S.paying ? "Please wait…" : "Pay Now"}</button>
        </div>
      </div>` : `<section class="checkout-card"><h1 class="kg-gtitle">${esc(g.name)}</h1><p>This game is not available right now.</p></section>`}`;
    bind();
  }

  /* ---------- actions ---------- */
  async function checkId() {
    const playerId = S.userId.trim();
    if (!playerId) { S.checkMsg = "Enter your " + idLabel(); S.check = null; return render(); }
    if (hasZone() && !S.zoneId.trim()) { S.checkMsg = "Enter " + zoneLabel(); return render(); }
    if (hasServer() && !S.server) { S.checkMsg = "Select server"; return render(); }
    S.checkMsg = "Checking…"; render();
    const r = await api("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: S.game.id, playerId, serverId: S.zoneId.trim() || S.server || undefined }),
    });
    const d = r.data || {};
    S.checkSoft = false;
    if (d.valid === true || d.result === "valid") {
      const tt = d.tiktok || null;
      S.check = { nickname: tt && tt.username ? "@" + tt.username + (d.nickname && d.nickname !== tt.username ? " · " + d.nickname : "") : (d.nickname || playerId) };
      S.checkMsg = "";
    } else {
      S.check = null;
      S.checkSoft = !!d.soft || (d.result !== "invalid" && !d.message);
      S.checkMsg = d.message || (d.result === "invalid" ? "Invalid ID" : r.status === 429 ? "Too many checks — wait a minute" : "Could not verify — you can still pay");
    }
    render();
  }

  async function applyCoupon() {
    const code = S.coupon.trim();
    if (!code) { S.discount = 0; S.couponMsg = ""; return render(); }
    const r = await api("/api/coupon/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal: subtotal() || 1 }),
    });
    if (!r.data.ok) {
      S.discount = 0;
      S.couponMsg = r.data.error === "min" ? "Order is below the minimum for this code" : "Invalid coupon";
    } else {
      S.discount = subtotal() ? Number(r.data.discount) || 0 : 0;
      S.couponMsg = "✓ Coupon applied";
    }
    render();
  }

  const ERRORS = {
    need_zone: "Please enter the zone ID",
    need_server: "Please select server",
    need_username: "Please enter your user ID",
    out_of_stock: "This package is out of stock",
    pack_unavailable: "This package is not available",
    maintenance: "Store is under maintenance",
    not_configured: "Payments are not set up yet",
    csrf: "Session expired — please try again",
  };

  /* ---------- "read before ordering" guide (admin-set per service) ---------- */
  const guideKey = () => "pp_guide_ok:" + (S.game && S.game.id);
  function guideOf(g) {
    const sg = g && g.safetyGuide;
    if (!sg || !sg.enabled) return null;
    const steps = (sg.stepsKm && sg.stepsKm.length ? sg.stepsKm : sg.stepsEn) || [];
    return steps.length ? { sg, steps } : null;
  }
  const hl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  function showGuide(onOk) {
    const x = guideOf(S.game);
    if (!x) return onOk();
    try { if (sessionStorage.getItem(guideKey())) return onOk(); } catch {}
    const { sg, steps } = x;
    let dlg = document.getElementById("gp-guide");
    if (dlg) dlg.remove();
    dlg = document.createElement("dialog");
    dlg.id = "gp-guide";
    dlg.className = "gp-guide";
    dlg.setAttribute("aria-labelledby", "gp-guide-t");
    const sub = sg.subtitleKm || sg.subtitleEn || "";
    dlg.innerHTML = `<div class="gg-card">
      <span class="gg-glow" aria-hidden="true"></span>
      <div class="gg-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2 2.6 19.5a1 1 0 0 0 .9 1.5h17a1 1 0 0 0 .9-1.5L12 3.2z"/><path d="M12 9.5v4.6"/><circle cx="12" cy="17.2" r=".6"/></svg></div>
      <h2 id="gp-guide-t" class="gg-title">${esc(sg.titleKm || sg.titleEn)}</h2>
      ${sub ? `<p class="gg-sub">${esc(sub)}</p>` : ""}
      ${(sg.chips || []).length ? `<div class="gg-chips">${sg.chips.map((c) => { const m = /^~(.+)~$/.exec(c); return `<span${m ? ' class="x"' : ""}>${esc(m ? m[1] : c)}</span>`; }).join("")}</div>` : ""}
      <ol class="gg-steps">${steps.map((t, i) => `<li><i>${i + 1}</i><span>${hl(t)}</span></li>`).join("")}</ol>
      <button type="button" class="gg-ok" id="gp-guide-ok">${esc(sg.buttonKm || sg.buttonEn || "យល់ព្រម")}</button>
    </div>`;
    document.body.appendChild(dlg);
    const done = (ok) => { dlg.close(); dlg.remove(); document.documentElement.classList.remove("gg-lock"); if (ok) { try { sessionStorage.setItem(guideKey(), "1"); } catch {} onOk(); } };
    dlg.querySelector("#gp-guide-ok").onclick = () => done(true);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) done(false); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    document.documentElement.classList.add("gg-lock");
    dlg.showModal();
    dlg.querySelector("#gp-guide-ok").focus();
  }

  async function pay(skipGuide) {
    const g = S.game;
    if (!S.pack) { S.payErr = "Please choose a package"; return render(); }
    const playerId = S.userId.trim();
    if (playerId.length < 3) { S.payErr = "Please enter your " + idLabel(); return render(); }
    if (hasZone() && !S.zoneId.trim()) { S.payErr = "Please enter " + zoneLabel(); return render(); }
    if (hasServer() && !S.server) { S.payErr = "Please select server"; return render(); }
    if (!S.agreed) { S.payErr = "Please agree to the terms before paying"; return render(); }
    if (skipGuide !== true && guideOf(g)) { let ok = false; try { ok = !!sessionStorage.getItem(guideKey()); } catch {} if (!ok) return showGuide(() => pay(true)); }

    S.payErr = ""; S.paying = true; render();
    const token = await csrfToken();
    const r = await api("/api/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      body: JSON.stringify({
        gameId: g.id,
        packId: S.pack.id,
        qty: S.qty,
        userId: playerId,
        zoneId: S.zoneId.trim(),
        server: S.server,
        nickname: S.check ? S.check.nickname : "",
        coupon: S.discount ? S.coupon.trim().toUpperCase() : "",
        idempotencyKey: `${g.id}-${S.pack.id}-${S.qty}-${playerId}-${S.zoneId.trim()}-${Math.floor(Date.now() / 120000)}`,
      }),
    });
    S.paying = false;
    const d = r.data || {};
    if (!r.ok) {
      const code = d.error || d.detail || "";
      S.payErr = ERRORS[code] || (d.message ? String(d.message) : "");
      if (!S.payErr) {
        // Show the real gateway reason (RielPay/ABA) so the owner can fix the key/config instead of a blind "failed".
        const why = String(d.detail || "").replace(/\s+/g, " ").slice(0, 160);
        S.payErr = code === "qr_failed"
          ? "Could not create the payment QR." + (why ? " Reason: " + why : "") + " Please try again or contact support."
          : "Checkout failed. Please try again.";
      }
      try { console.warn("[checkout]", r.status, d); } catch (_) {}
      return render();
    }
    const p = d.payment || {};
    if (!p.qrImage && !p.qrString) {
      S.payErr = "Payment is not available right now. Please contact support.";
      return render();
    }
    render();
    showQr(d);
  }

  /* ---------- KHQR + polling ---------- */
  function stopPoll() { if (S.timer) clearInterval(S.timer); S.timer = null; }

  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  function abaDeeplink(p) {
    const dl = String(p.deeplink || "");
    if (/^abamobilebank:\/\//i.test(dl)) return dl;
    if (p.qrString) return "abamobilebank://ababank.com?type=payway&qrcode=" + encodeURIComponent(p.qrString);
    return "";
  }
  function fmtTime(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + String(s).padStart(2, "0"); }
  function startCountdown(expiresAt) {
    clearInterval(S.cd);
    let end = Date.parse(expiresAt);
    if (!Number.isFinite(end) || end < Date.now() + 20000) end = Date.now() + 180000;
    const total = Math.max(30, Math.round((end - Date.now()) / 1000));
    const ring = $("#qr-ring"), txt = $("#qr-time"), C = 2 * Math.PI * 15;
    ring.style.strokeDasharray = String(C);
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      txt.textContent = fmtTime(left);
      ring.style.strokeDashoffset = String(C * (1 - left / total));
      if (left <= 0) { clearInterval(S.cd); stopPoll(); $("#qr-expired").classList.remove("hidden"); }
    };
    tick();
    S.cd = setInterval(tick, 1000);
  }

  function showQr(d) {
    const p = d.payment;
    S.checkoutId = (d.order && d.order.id) || null;
    S.qrImage = p.qrImage || "";
    $("#qr-amount").textContent = Number((d.order && d.order.total) || total()).toFixed(2);
    $("#qr-box").innerHTML = p.qrImage
      ? `<img src="${esc(p.qrImage)}" alt="KHQR">`
      : `<pre>${esc(p.qrString)}</pre>`;
    $("#qr-download").hidden = !p.qrImage;
    $("#qr-expired").classList.add("hidden");

    // ABA Mobile: custom-scheme deeplink (opens the app straight to the payment) or the https /open-aba helper
    const native = abaDeeplink(p);
    const link = $("#qr-deeplink");
    const href = native || p.openAbaUrl || p.deeplink || p.payUrl || "";
    if (href) { link.href = href; link.classList.remove("hidden"); } else link.classList.add("hidden");
    $("#qr-status").textContent = "Waiting for payment…";
    $("#qr-dialog").showModal();
    startCountdown(p.expiresAt);
    stopPoll();
    S.timer = setInterval(checkPaid, 4000);

    // Phones with ABA: jump into the app automatically (QR stays here if the app is missing / user comes back)
    if (IS_MOBILE && native) {
      setTimeout(() => {
        try { const a = document.createElement("a"); a.href = native; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); } catch {}
      }, 450);
    }
  }

  async function downloadQr() {
    if (!S.qrImage) return;
    const name = "khqr-" + (S.checkoutId || "pay") + ".png";
    try {
      const blob = await (await fetch(S.qrImage)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      window.open(S.qrImage, "_blank");
    }
  }

  async function checkPaid() {
    if (!S.checkoutId) return;
    const r = await api(`/api/checkout/${encodeURIComponent(S.checkoutId)}/status`);
    const order = r.data && r.data.order;
    if (order && order.status && order.status !== "pending") {
      stopPoll(); clearInterval(S.cd);
      $("#qr-dialog").close();
      location.href = "/success?code=" + encodeURIComponent(S.checkoutId);
    } else {
      $("#qr-status").textContent = "Payment not received yet";
    }
  }

  /* ---------- bindings ---------- */
  function bind() {
    const user = $("#f-user");
    if (user) user.oninput = (e) => { S.userId = e.target.value; S.check = null; S.checkMsg = ""; };
    const zone = $("#f-zone");
    if (zone) zone.oninput = (e) => { S.zoneId = e.target.value; S.check = null; };
    const srv = $("#f-server");
    if (srv) srv.onchange = (e) => { S.server = e.target.value; S.check = null; };
    const cp = $("#f-coupon");
    if (cp) cp.oninput = (e) => { S.coupon = e.target.value; };
    const ag = $("#f-agree");
    if (ag) ag.onchange = (e) => { S.agreed = e.target.checked; S.payErr = ""; };
    const cb = $("#btn-check");
    if (cb) cb.onclick = checkId;
    const cpb = $("#btn-coupon");
    if (cpb) cpb.onclick = applyCoupon;
    const pb = $("#btn-pay");
    if (pb) pb.onclick = () => pay();
    const pbar = $("#btn-pay-bar");
    if (pbar) pbar.onclick = () => pay();
    root.querySelectorAll("[data-pack]").forEach((b) => {
      b.onclick = () => {
        S.pack = S.game.packs.find((p) => String(p.id) === b.dataset.pack) || null;
        S.discount = 0; S.couponMsg = ""; S.payErr = "";
        S.bump = true;
        try { navigator.vibrate && navigator.vibrate(12); } catch {}
        render();
        S.bump = false;
      };
    });
    root.querySelectorAll("[data-like]").forEach((b) => { b.onclick = toggleLike; });
    root.querySelectorAll("[data-jump]").forEach((b) => {
      b.onclick = () => {
        const t = document.getElementById(b.dataset.jump);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
    root.querySelectorAll("[data-qty]").forEach((b) => {
      b.onclick = () => {
        S.qty = Math.min(10, Math.max(1, S.qty + Number(b.dataset.qty)));
        if (S.discount) { S.discount = 0; S.couponMsg = ""; }
        render();
      };
    });
  }

  const closeQr = () => { stopPoll(); clearInterval(S.cd); $("#qr-dialog").close(); };
  $("#qr-close").onclick = closeQr;
  $("#qr-close2").onclick = closeQr;
  $("#qr-download").onclick = downloadQr;
  $("#qr-dialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeQr(); });
  // Came back from ABA app → check payment immediately
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.checkoutId && $("#qr-dialog").open) checkPaid(); });

  /* ---------- header search ---------- */
  (function () {
    const q = $("#kg-q"), box = $("#kg-results");
    if (!q || !box) return;
    const show = () => {
      const t = q.value.trim().toLowerCase();
      const list = t ? (S.all || []).filter((g) => (g.name + " " + (g.nameKm || "") + " " + g.id).toLowerCase().includes(t)).slice(0, 7) : [];
      box.classList.toggle("hidden", !list.length && !t);
      box.innerHTML = list.length
        ? list.map((g) => `<a href="/game/${encodeURIComponent(g.id)}">${g.image ? `<img src="${esc(g.image)}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : `<i>${esc(String(g.name || "?").charAt(0))}</i>`}<span>${esc(g.name)}</span></a>`).join("")
        : `<p>No games found</p>`;
    };
    q.addEventListener("input", show);
    q.addEventListener("focus", show);
    document.addEventListener("click", (e) => { if (!e.target.closest(".kg-search")) box.classList.add("hidden"); });
    q.addEventListener("keydown", (e) => { if (e.key === "Escape") { box.classList.add("hidden"); q.blur(); } });
  })();

  /* ---------- load ---------- */
  async function load() {
    if (!gameId) { S.error = "Missing game id."; return render(); }
    root.innerHTML = '<div class="sk-hero"></div><div class="sk-card"><div class="sk-line w40"></div><div class="sk-grid">' + '<div class="sk-tile"></div>'.repeat(6) + '</div></div>';
    const [r, lk] = await Promise.all([api("/api/catalog"), api("/api/likes")]);
    S.likes = (lk.data && lk.data.likes) || {};
    const games = (r.data && r.data.games) || [];
    S.all = games;
    S.game = games.find((g) => String(g.id) === gameId) || null;
    if (!S.game) S.error = "Game not found.";
    document.title = S.game ? `${S.game.name} · POR POR TOPUP` : "POR POR TOPUP";
    render();
  }
  load();
})();
