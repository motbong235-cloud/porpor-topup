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
  const idLabel = () => (S.game.numericId ? "User ID" : "Player ID");
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

  /* Package cards — icon + gold price + name, coin chip (top-right), tag ribbon (bottom-left) */
  function packOption(p) {
    const sel = S.pack && String(S.pack.id) === String(p.id);
    const oos = p.inStock === false;
    const icon = p.image
      ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async">`
      : `<span class="pk-icon-letter">${esc(String(p.name || "?").charAt(0).toUpperCase())}</span>`;
    const bonus = bonusText(p.bonus);
    const tag = String(p.tag || (p.hot ? "HOT" : "")).trim();
    return `<button type="button" class="pk-item premium-card-v2 package-item${sel ? " is-selected" : ""}${oos ? " is-oos" : ""}${tag ? " has-tag" : ""}" role="radio" aria-checked="${!!sel}" data-selected="${!!sel}" data-pack="${esc(p.id)}" ${oos ? "disabled" : ""}>
      ${bonus ? `<span class="pk-coin">${ICON_COIN}${esc(bonus)}</span>` : ""}
      <span class="pk-icon crystal-float-v2">${icon}</span>
      <span class="pk-copy" data-card-details>
        <span class="pk-price card-price-text">${oos ? "Out of stock" : money(p.price)}</span>
        <span class="pk-name card-title-text">${esc(p.name)}</span>
      </span>
      ${tag ? `<span class="pk-ribbon">${ICON_TAG}${esc(tag)}</span>` : ""}
    </button>`;
  }

  function packGroups() {
    const groups = new Map();
    (S.game.packs || []).forEach((p) => {
      const key = p.category || "Packages";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()].map(([cat, list]) => `
      <div class="pk-group">
        <div class="pk-head">
          <span class="pk-head__title">${ICON_STAR}${esc(cat)}</span>
          <span class="pk-head__count">${ICON_THUMB}${list.length}</span>
        </div>
        <div class="pk-grid" role="radiogroup">${list.map(packOption).join("")}</div>
      </div>`).join("");
  }

  function render() {
    const g = S.game;
    if (!g) {
      root.innerHTML = `<section class="checkout-card"><p>${esc(S.error || "Game not found.")}</p><a class="checkout-btn" href="/">Back to home</a></section>`;
      return;
    }
    const open = g.open !== false;
    const hint = idHint();
    root.innerHTML = `
      <section class="checkout-hero">
        <div class="checkout-hero__img">${g.image ? `<img src="${esc(g.image)}" alt="">` : `<span>${esc(String(g.name || "?").charAt(0))}</span>`}</div>
        <div><h1 class="checkout-hero__title">${esc(g.name)}</h1>
          <p class="checkout-hero__sub">${open ? "Instant delivery" : "Currently unavailable"}</p></div>
      </section>
      ${open ? `
      <div class="game-checkout-layout">
        <div class="game-checkout-sidebar">
          <section class="checkout-card" data-checkout-player-section>
            <h2 class="checkout-card__title">${esc(idLabel())}</h2>
            <div class="checkout-field">
              <div class="checkout-row">
                <input id="f-user" class="checkout-input" value="${esc(S.userId)}" autocomplete="off" ${g.numericId ? 'inputmode="numeric"' : ""} placeholder="${esc(hint || idLabel())}">
                <button type="button" class="checkout-btn checkout-btn--ghost" id="btn-check">Check ID</button>
              </div>
              ${hint ? `<p class="checkout-help">${esc(hint)}</p>` : ""}
              <p class="checkout-help ${S.check ? "is-ok" : "is-err"}" id="check-msg">${S.check ? "✓ " + esc(S.check.nickname) : esc(S.checkMsg)}</p>
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

          <section class="checkout-card" data-checkout-products-section>
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
        </div>
        <div class="pk-bar">
          <div class="pk-bar__total"><span>Total:</span><strong>${money(total())}</strong></div>
          <button type="button" class="pk-bar__pay" id="btn-pay-bar" ${S.paying || !S.pack ? "disabled" : ""}>${ICON_BAG}${S.paying ? "Please wait…" : "Pay Now"}</button>
        </div>
      </div>` : `<section class="checkout-card"><p>This game is not available right now.</p></section>`}`;
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
    if (d.valid === true || d.result === "valid") {
      S.check = { nickname: d.nickname || playerId };
      S.checkMsg = "";
    } else {
      S.check = null;
      S.checkMsg = d.message || (d.result === "invalid" ? "Invalid ID" : "Could not verify — you can still pay");
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

  async function pay() {
    const g = S.game;
    if (!S.pack) { S.payErr = "Please choose a package"; return render(); }
    const playerId = S.userId.trim();
    if (playerId.length < 3) { S.payErr = "Please enter your " + idLabel(); return render(); }
    if (hasZone() && !S.zoneId.trim()) { S.payErr = "Please enter " + zoneLabel(); return render(); }
    if (hasServer() && !S.server) { S.payErr = "Please select server"; return render(); }
    if (!S.agreed) { S.payErr = "Please agree to the terms before paying"; return render(); }

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
      S.payErr = ERRORS[code] || (d.message ? String(d.message) : "Checkout failed. Please try again.");
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

  function showQr(d) {
    const p = d.payment;
    S.checkoutId = (d.order && d.order.id) || null;
    $("#qr-amount").textContent = money((d.order && d.order.total) || total());
    $("#qr-box").innerHTML = p.qrImage
      ? `<img src="${esc(p.qrImage)}" alt="KHQR">`
      : `<pre>${esc(p.qrString)}</pre>`;
    const link = $("#qr-deeplink");
    const dl = p.deeplink || p.openAbaUrl || p.payUrl;
    if (dl) { link.href = dl; link.classList.remove("hidden"); } else link.classList.add("hidden");
    $("#qr-status").textContent = "Waiting for payment…";
    $("#qr-dialog").showModal();
    stopPoll();
    S.timer = setInterval(checkPaid, 5000);
  }

  async function checkPaid() {
    if (!S.checkoutId) return;
    const r = await api(`/api/checkout/${encodeURIComponent(S.checkoutId)}/status`);
    const order = r.data && r.data.order;
    if (order && order.status && order.status !== "pending") {
      stopPoll();
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
    if (pb) pb.onclick = pay;
    const pbar = $("#btn-pay-bar");
    if (pbar) pbar.onclick = pay;
    root.querySelectorAll("[data-pack]").forEach((b) => {
      b.onclick = () => {
        S.pack = S.game.packs.find((p) => String(p.id) === b.dataset.pack) || null;
        S.discount = 0; S.couponMsg = ""; S.payErr = "";
        render();
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

  $("#qr-close").onclick = () => { stopPoll(); $("#qr-dialog").close(); };
  $("#qr-dialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) { stopPoll(); e.currentTarget.close(); } });

  /* ---------- load ---------- */
  async function load() {
    if (!gameId) { S.error = "Missing game id."; return render(); }
    const r = await api("/api/catalog");
    const games = (r.data && r.data.games) || [];
    S.game = games.find((g) => String(g.id) === gameId) || null;
    if (!S.game) S.error = "Game not found.";
    document.title = S.game ? `${S.game.name} · POR POR TOPUP` : "POR POR TOPUP";
    render();
  }
  load();
})();
