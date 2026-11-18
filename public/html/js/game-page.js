/* Generic game top-up page. Fields come from the admin-set catalog:
   idHintEn/idHintKm (ID label + hint), numericId, hasZone (+ zoneLabel),
   servers [{value,label}], requireUsername, packs[]. */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const root = $("#game-root");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  const gameId = new URLSearchParams(location.search).get("id") || "";

  const S = {
    game: null,
    error: "",
    check: null,      // { nickname }
    checkMsg: "",
    pack: null,
    qty: 1,
    userId: "",
    zoneId: "",
    server: "",
    coupon: "",
    discount: 0,
    couponMsg: "",
    agreed: false,
    payErr: "",
    paying: false,
    checkoutId: null,
    timer: null,
    csrf: "",
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
  function render() {
    const g = S.game;
    if (!g) {
      root.innerHTML = `<div class="gp-card"><p>${esc(S.error || "Game not found.")}</p><a class="gp-btn gp-btn-ghost" href="index.html">Back to home</a></div>`;
      return;
    }
    const open = g.open !== false;
    const packs = (g.packs || []).map((p) => {
      const sel = S.pack && String(S.pack.id) === String(p.id);
      const oos = p.inStock === false;
      return `<button type="button" class="gp-pack" role="radio" aria-checked="${!!sel}" data-pack="${esc(p.id)}" ${oos ? "disabled" : ""}>
        <div class="gp-pack-name">${esc(p.name)}</div>
        ${p.bonus ? `<div class="gp-pack-note">${esc(p.bonus)}</div>` : ""}
        <div class="gp-pack-price">${oos ? "Out of stock" : money(p.price)}</div>
      </button>`;
    }).join("");

    const fields = `
      <div class="gp-field">
        <label for="f-user">${esc(idLabel())}${g.requireUsername ? "" : ""}</label>
        <div class="gp-row">
          <input id="f-user" class="gp-input" value="${esc(S.userId)}" autocomplete="off" ${g.numericId ? 'inputmode="numeric"' : ""} placeholder="${esc(idHint() || idLabel())}">
          <button type="button" class="gp-btn gp-btn-ghost gp-btn-sm" id="btn-check">Check ID</button>
        </div>
        ${idHint() ? `<div class="gp-help">${esc(idHint())}</div>` : ""}
        <div class="gp-help ${S.check ? "gp-ok" : "gp-err"}" id="check-msg">${S.check ? "✓ " + esc(S.check.nickname) : esc(S.checkMsg)}</div>
      </div>
      ${hasZone() ? `<div class="gp-field">
        <label for="f-zone">${esc(zoneLabel())}</label>
        <input id="f-zone" class="gp-input" value="${esc(S.zoneId)}" autocomplete="off" inputmode="numeric">
      </div>` : ""}
      ${hasServer() ? `<div class="gp-field">
        <label for="f-server">Server</label>
        <select id="f-server" class="gp-select">
          <option value="">Select server</option>
          ${g.servers.map((s) => `<option value="${esc(s.value)}" ${String(S.server) === String(s.value) ? "selected" : ""}>${esc(s.label || s.value)}</option>`).join("")}
        </select>
      </div>` : ""}`;

    root.innerHTML = `
      <div class="gp-card gp-banner">
        <div class="gp-banner-img">${g.image ? `<img src="${esc(g.image)}" alt="">` : `<span>${esc(g.mark || "·")}</span>`}</div>
        <div><h1 class="gp-title">${esc(g.name)}</h1>
          <div class="gp-muted">${open ? "Instant delivery" : "Currently unavailable"}</div></div>
      </div>
      ${open ? `<div class="gp-grid">
        <div class="gp-card">
          <h2 class="gp-h">Account</h2>
          ${fields}
        </div>
        <div class="gp-card">
          <h2 class="gp-h">Package</h2>
          ${packs ? `<div class="gp-packs" role="radiogroup">${packs}</div>` : `<p class="gp-muted">No packages available.</p>`}
          <div class="gp-qty">
            <span>Quantity</span>
            <button type="button" data-qty="-1" aria-label="Less">−</button>
            <b>${S.qty}</b>
            <button type="button" data-qty="1" aria-label="More">+</button>
          </div>
          <div class="gp-row" style="margin-top:14px">
            <input id="f-coupon" class="gp-input" value="${esc(S.coupon)}" placeholder="Coupon code" autocomplete="off">
            <button type="button" class="gp-btn gp-btn-ghost gp-btn-sm" id="btn-coupon">Apply</button>
          </div>
          <div class="gp-help ${S.couponMsg.startsWith("✓") ? "gp-ok" : "gp-err"}">${esc(S.couponMsg)}</div>
          <div style="margin-top:14px">
            <div class="gp-summary-line"><span>${S.pack ? esc(S.pack.name) + " × " + S.qty : "Select a package"}</span><span>${money(subtotal())}</span></div>
            <div class="gp-summary-line"><span>Coupon</span><span>−${money(S.discount)}</span></div>
            <div class="gp-total"><span>Total</span><span>${money(total())}</span></div>
          </div>
          <label class="gp-terms"><input type="checkbox" id="f-agree" ${S.agreed ? "checked" : ""}>
            <span>I agree to the <a href="index.html#terms">Terms</a> and confirm the account details are correct.</span></label>
          <div class="gp-err" id="pay-err">${esc(S.payErr)}</div>
          <button type="button" class="gp-btn" id="btn-pay" style="margin-top:8px" ${S.paying || !S.pack ? "disabled" : ""}>
            ${S.paying ? "Please wait…" : S.pack ? "Pay " + money(total()) : "Select a package"}
          </button>
        </div>
      </div>` : `<div class="gp-card"><p>This game is not available right now.</p></div>`}`;
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
    need_zone: "Please enter " + "zone ID",
    need_server: "Please select server",
    need_username: "Please enter your " + "user ID",
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
