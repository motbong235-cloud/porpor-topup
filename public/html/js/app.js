/* POR POR TOPUP — static HTML front end (no framework).
   Talks to the same porpor API the React app uses:
   /api/catalog, /api/csrf, /api/verify, /api/coupon/preview,
   /api/checkout/create, /api/checkout/:id/status,
   /api/auth/telegram/config, /api/auth/telegram, /api/auth/me, /api/auth/logout */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const S = {
    games: [],
    loaded: false,
    query: "",
    tab: "game",
    user: null,
    csrf: "",
    // game page state
    game: null,
    userId: "",
    zoneId: "",
    server: "",
    check: null,      // { nickname } after /api/verify
    checkErr: "",
    pack: null,
    qty: 1,
    coupon: "",
    discount: 0,
    couponMsg: "",
    agreed: false,
    payErr: "",
    paying: false,
    checkoutId: null,
    pollTimer: null,
  };

  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "include", ...opts });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function ensureCsrf() {
    if (S.csrf) return S.csrf;
    const r = await api("/api/csrf");
    S.csrf = r.data.csrf || "";
    return S.csrf;
  }

  function minPrice(g) {
    const ps = (g.packs || []).map((p) => Number(p.price)).filter((n) => n > 0);
    return ps.length ? Math.min(...ps) : null;
  }

  function tileHtml(g) {
    if (g.image) return `<img src="${esc(g.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`;
    return `<span class="text-3xl font-bold text-daddy-orange">${esc(g.mark || "·")}</span>`;
  }

  /* ---------- Home ---------- */
  function cardHtml(g) {
    const from = minPrice(g);
    const open = g.open !== false;
    const inner = `
      <div class="aspect-square bg-daddy-dark-purple flex items-center justify-center overflow-hidden">${tileHtml(g)}</div>
      <div class="p-3">
        <div class="font-semibold truncate">${esc(g.name)}</div>
        ${open && from != null ? `<div class="text-xs text-daddy-text-darker">From ${money(from)}</div>` : ""}
        <span class="block mt-2 text-center rounded-full py-1.5 text-sm font-bold ${open ? "bg-gradient-to-r from-daddy-light-purple to-daddy-orange text-daddy-dark-purple" : "bg-gray-700 text-gray-300"}">${open ? "TOP UP" : "UNAVAILABLE"}</span>
      </div>`;
    return open
      ? `<a href="#/game/${encodeURIComponent(g.id)}" class="block rounded-2xl overflow-hidden bg-daddy-dark-purple/60 border border-daddy-light-purple/20 hover:border-daddy-orange transition">${inner}</a>`
      : `<div class="block rounded-2xl overflow-hidden bg-daddy-dark-purple/60 border border-daddy-light-purple/20 opacity-60 grayscale">${inner}</div>`;
  }

  function renderHome() {
    const q = S.query.trim().toLowerCase();
    const list = S.games.filter((g) => !q || String(g.name || "").toLowerCase().includes(q));
    const grid = list.length
      ? `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">${list.map(cardHtml).join("")}</div>`
      : `<p class="text-center py-12 text-daddy-text-darker">${S.loaded ? "No games found" : "Loading games…"}</p>`;
    app.innerHTML = `
      <section class="mt-3 rounded-2xl p-6 bg-daddy-dark-purple border border-daddy-light-purple/20">
        <p class="text-xs uppercase tracking-widest text-daddy-orange font-bold">Fast · Safe</p>
        <h1 class="text-2xl sm:text-3xl font-extrabold mt-1 text-primary">POR POR TOPUP</h1>
        <p class="text-daddy-text-darker mt-1">Game top-up with ABA KHQR</p>
      </section>
      <h2 class="mt-6 mb-3 text-lg font-extrabold text-primary">${S.query ? "Results" : "All Games"}</h2>
      ${grid}`;
  }

  /* ---------- Game / checkout ---------- */
  function fieldsOf(g) {
    const zone = g.hasZone && !(g.servers && g.servers.length);
    return {
      id: true,
      zone,
      server: !!(g.servers && g.servers.length),
    };
  }

  function subtotal() {
    return S.pack ? Number(S.pack.price) * S.qty : 0;
  }
  function total() {
    return Math.max(0, subtotal() - S.discount);
  }

  function renderGame() {
    const g = S.game;
    if (!g) return renderHome();
    const f = fieldsOf(g);
    const open = g.open !== false;
    const idLabel = g.idHintEn || "Player ID";
    const packs = (g.packs || []).map((p) => {
      const sel = S.pack && S.pack.id === p.id;
      const oos = p.inStock === false;
      return `<button type="button" role="radio" aria-checked="${!!sel}" data-pack="${esc(p.id)}" ${oos ? "disabled" : ""}
        class="text-left rounded-xl p-3 border min-w-0 ${sel ? "border-daddy-orange bg-daddy-orange/10" : "border-daddy-light-purple/25 bg-daddy-dark-purple/50"} ${oos ? "opacity-50" : ""}">
        <div class="font-semibold truncate">${esc(p.nameKm && false ? p.nameKm : p.name || p.label)}</div>
        <div class="text-daddy-orange font-bold">${money(p.price)}</div>
        ${p.badge ? `<div class="text-[10px] text-daddy-text-darker">${esc(p.badge)}</div>` : ""}
      </button>`;
    }).join("");

    app.innerHTML = `
      <button type="button" class="text-daddy-orange font-semibold py-3" data-back>← Back</button>
      <div class="grid gap-4 md:grid-cols-[1.6fr_1fr] items-start">
        <div class="space-y-4 min-w-0">
          <section class="rounded-2xl p-4 bg-daddy-dark-purple/60 border border-daddy-light-purple/20 flex gap-4 items-center">
            <div class="w-20 h-20 rounded-2xl overflow-hidden bg-daddy-dark-purple flex items-center justify-center flex-shrink-0">${tileHtml(g)}</div>
            <div class="min-w-0"><h1 class="text-xl font-extrabold truncate">${esc(g.name)}</h1>
              <p class="text-sm text-daddy-text-darker">${open ? "Instant delivery" : "Currently unavailable"}</p></div>
          </section>
          ${open ? `
          <section class="rounded-2xl p-4 bg-daddy-dark-purple/60 border border-daddy-light-purple/20 space-y-3">
            <label class="block text-xs font-bold uppercase tracking-wider text-daddy-text-darker">${esc(idLabel)}</label>
            <div class="flex gap-2">
              <input id="userId" value="${esc(S.userId)}" class="flex-1 min-w-0 rounded-lg px-3 py-2 bg-daddy-purple border border-daddy-light-purple/30 focus:outline-none" autocomplete="off" inputmode="text">
              ${f.zone ? `<input id="zoneId" value="${esc(S.zoneId)}" placeholder="Zone" class="w-24 rounded-lg px-3 py-2 bg-daddy-purple border border-daddy-light-purple/30 focus:outline-none" autocomplete="off" inputmode="numeric">` : ""}
            </div>
            ${f.server ? `<select id="server" class="w-full rounded-lg px-3 py-2 bg-daddy-purple border border-daddy-light-purple/30">
                <option value="">Select server</option>
                ${g.servers.map((s) => `<option value="${esc(s.id ?? s.code ?? s)}" ${String(S.server) === String(s.id ?? s.code ?? s) ? "selected" : ""}>${esc(s.name ?? s.label ?? s)}</option>`).join("")}
              </select>` : ""}
            <div class="flex items-center gap-3 flex-wrap">
              <button type="button" id="checkBtn" class="px-4 py-2 rounded-lg bg-daddy-light-purple text-daddy-dark-purple font-bold">Check ID</button>
              <span class="text-sm ${S.check ? "text-green-400" : "text-red-300"}">${S.check ? "✓ " + esc(S.check.nickname) : esc(S.checkErr)}</span>
            </div>
          </section>
          <section class="rounded-2xl p-4 bg-daddy-dark-purple/60 border border-daddy-light-purple/20">
            <h2 class="text-sm font-bold uppercase tracking-wider text-daddy-text-darker mb-3">Choose package</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${packs || '<p class="text-daddy-text-darker">No packages</p>'}</div>
            <div class="flex items-center gap-3 mt-4">
              <span class="text-sm font-bold">Quantity</span>
              <button type="button" class="w-9 h-9 rounded-lg border border-daddy-light-purple/40" data-qty="-1" aria-label="Less">−</button>
              <b class="min-w-[2ch] text-center">${S.qty}</b>
              <button type="button" class="w-9 h-9 rounded-lg border border-daddy-light-purple/40" data-qty="1" aria-label="More">+</button>
            </div>
            <div class="flex gap-2 mt-4">
              <input id="coupon" value="${esc(S.coupon)}" placeholder="Coupon code" class="flex-1 min-w-0 rounded-lg px-3 py-2 bg-daddy-purple border border-daddy-light-purple/30 focus:outline-none" autocomplete="off">
              <button type="button" id="couponBtn" class="px-4 rounded-lg border border-daddy-light-purple/40">Apply</button>
            </div>
            <p class="text-sm mt-1 ${S.couponMsg.startsWith("✓") ? "text-green-400" : "text-red-300"}">${esc(S.couponMsg)}</p>
          </section>` : `<section class="rounded-2xl p-4 bg-daddy-dark-purple/60 border border-daddy-light-purple/20"><p>This game is not available right now.</p></section>`}
        </div>
        <aside class="rounded-2xl p-4 bg-daddy-dark-purple/60 border border-daddy-light-purple/20 md:sticky md:top-24">
          <div class="flex items-center gap-3 p-3 rounded-xl border border-daddy-orange bg-daddy-orange/5">
            <span class="w-10 h-10 rounded-lg bg-[#efefed] text-daddy-dark-purple font-black text-xs flex items-center justify-center">ABA</span>
            <div><b>ABA PayWay</b><div class="text-xs text-daddy-text-darker">Pay the full amount with ABA KHQR</div></div>
          </div>
          <label class="flex gap-2 items-start mt-4 text-xs text-gray-300">
            <input type="checkbox" id="agree" class="mt-0.5 w-4 h-4" ${S.agreed ? "checked" : ""}>
            <span>I agree to the <a href="#/terms" class="text-daddy-orange underline">Terms</a> &amp; Privacy Policy.</span>
          </label>
          <div class="mt-4 space-y-1 text-sm">
            <div class="flex justify-between text-daddy-text-darker"><span>${S.pack ? esc(S.pack.name || S.pack.label) + " × " + S.qty : "Select a package"}</span><span>${money(subtotal())}</span></div>
            <div class="flex justify-between text-daddy-text-darker"><span>Coupon</span><span>−${money(S.discount)}</span></div>
            <div class="flex justify-between text-lg font-extrabold border-t border-dashed border-daddy-light-purple/30 pt-2 mt-2"><span>Total</span><span>${money(total())}</span></div>
          </div>
          <p class="text-sm text-red-300 mt-2" id="payErr">${esc(S.payErr)}</p>
          <button type="button" id="payBtn" class="mt-2 w-full py-3 rounded-full font-extrabold bg-gradient-to-r from-daddy-light-purple to-daddy-orange text-daddy-dark-purple disabled:opacity-50" ${open && !S.paying ? "" : "disabled"}>
            ${S.paying ? "…" : S.pack ? "Pay " + money(total()) + " →" : "Select a package →"}
          </button>
        </aside>
      </div>`;
    bindGame();
  }

  function renderTerms() {
    app.innerHTML = `<button type="button" class="text-daddy-orange font-semibold py-3" data-back>← Back</button>
      <section class="rounded-2xl p-5 bg-daddy-dark-purple/60 border border-daddy-light-purple/20">
        <h1 class="text-xl font-extrabold text-primary">Terms &amp; Privacy</h1>
        <p class="mt-3 text-daddy-text-darker">Orders are delivered automatically after payment is confirmed. For help, contact support in Telegram.</p></section>`;
    bindCommon();
  }

  /* ---------- Bindings ---------- */
  function bindCommon() {
    app.querySelectorAll("[data-back]").forEach((b) => b.onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/")));
  }

  function bindGame() {
    bindCommon();
    const uid = $("#userId");
    if (uid) uid.oninput = (e) => { S.userId = e.target.value; S.check = null; S.checkErr = ""; };
    const zid = $("#zoneId");
    if (zid) zid.oninput = (e) => { S.zoneId = e.target.value; S.check = null; };
    const srv = $("#server");
    if (srv) srv.onchange = (e) => { S.server = e.target.value; S.check = null; };
    app.querySelectorAll("[data-pack]").forEach((b) => b.onclick = () => {
      S.pack = S.game.packs.find((p) => String(p.id) === b.dataset.pack) || null;
      S.discount = 0; S.couponMsg = ""; S.payErr = ""; renderGame();
    });
    app.querySelectorAll("[data-qty]").forEach((b) => b.onclick = () => {
      S.qty = Math.min(10, Math.max(1, S.qty + Number(b.dataset.qty)));
      if (S.discount) S.discount = 0, S.couponMsg = "";
      renderGame();
    });
    const cp = $("#coupon");
    if (cp) cp.oninput = (e) => (S.coupon = e.target.value);
    const cb = $("#couponBtn");
    if (cb) cb.onclick = applyCoupon;
    const ag = $("#agree");
    if (ag) ag.onchange = (e) => { S.agreed = e.target.checked; if (S.agreed) { S.payErr = ""; const el = $("#payErr"); if (el) el.textContent = ""; } };
    const cbtn = $("#checkBtn");
    if (cbtn) cbtn.onclick = checkId;
    const pb = $("#payBtn");
    if (pb) pb.onclick = pay;
  }

  async function checkId() {
    const g = S.game;
    const playerId = (S.userId || "").trim().replace(/^@/, "");
    if (!playerId) { S.checkErr = "Enter your " + (g.idHintEn || "Player ID"); return renderGame(); }
    const f = fieldsOf(g);
    if (f.zone && !S.zoneId.trim()) { S.checkErr = "Enter zone ID"; return renderGame(); }
    if (f.server && !S.server) { S.checkErr = "Select server"; return renderGame(); }
    S.checkErr = "Checking…"; renderGame();
    const r = await api("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: g.id, playerId, serverId: S.zoneId.trim() || S.server || undefined }),
    });
    const d = r.data || {};
    const ok = d.result === "valid" || d.result === "ok" || d.valid === true;
    if (ok) {
      S.check = { nickname: d.nickname || d.roblox?.displayName || d.roblox?.username || "OK" };
      S.checkErr = "";
    } else {
      S.check = null;
      S.checkErr = d.result === "invalid" || d.valid === false ? "Invalid ID" : "Could not verify — you can still pay";
    }
    renderGame();
  }

  async function applyCoupon() {
    const code = (S.coupon || "").trim();
    if (!code) { S.discount = 0; S.couponMsg = ""; return renderGame(); }
    const r = await api("/api/coupon/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal: subtotal() || 1 }),
    });
    if (!r.data.ok) { S.discount = 0; S.couponMsg = r.data.error === "min" ? "Order is below the minimum for this code" : "Invalid coupon"; }
    else { S.discount = subtotal() ? Number(r.data.discount) || 0 : 0; S.couponMsg = "✓ Coupon applied"; }
    renderGame();
  }

  async function pay() {
    const g = S.game;
    const f = fieldsOf(g);
    const playerId = (S.userId || "").trim();
    if (!S.pack) { S.payErr = "Please choose a package"; return renderGame(); }
    if (!playerId) { S.payErr = "Please enter your " + (g.idHintEn || "Player ID"); return renderGame(); }
    if (f.zone && !S.zoneId.trim()) { S.payErr = "Please enter zone ID"; return renderGame(); }
    if (f.server && !S.server) { S.payErr = "Please select server"; return renderGame(); }
    if (!S.agreed) { S.payErr = "Please agree to the terms before paying"; return renderGame(); }
    S.payErr = ""; S.paying = true; renderGame();
    try {
      const csrf = await ensureCsrf();
      const r = await api("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          gameId: g.id,
          packId: S.pack.id,
          qty: S.qty,
          userId: playerId,
          zoneId: S.zoneId.trim(),
          server: S.server,
          nickname: S.check ? S.check.nickname : "",
          coupon: S.discount ? S.coupon.trim().toUpperCase() : "",
          idempotencyKey: `pp-${g.id}-${S.pack.id}-${S.qty}-${playerId}-${S.zoneId.trim()}-${Math.floor(Date.now() / 120000)}`,
        }),
      });
      const d = r.data || {};
      if (!r.ok) {
        S.payErr = d.message || (d.error ? "Checkout failed: " + d.error : "Checkout failed. Please try again.");
        S.paying = false; return renderGame();
      }
      if (!d.payment || (!d.payment.qrImage && !d.payment.qrString && !d.payment.qr_string)) {
        S.payErr = "Payments are not set up yet. Please contact support.";
        S.paying = false; return renderGame();
      }
      S.paying = false; renderGame();
      showQr(d);
    } catch (e) {
      S.paying = false;
      S.payErr = "Cannot reach server — please try again";
      renderGame();
    }
  }

  function showQr(d) {
    const p = d.payment;
    S.checkoutId = (d.order && d.order.id) || d.checkoutId || p.checkoutId || null;
    $("#qrAmount").textContent = money((d.order && d.order.total) || total());
    const box = $("#qrBox");
    box.innerHTML = p.qrImage
      ? `<img src="${esc(p.qrImage)}" alt="KHQR" style="width:220px;height:220px;max-width:100%">`
      : `<pre class="text-xs break-all whitespace-pre-wrap max-w-full p-2 bg-gray-100 rounded">${esc(p.qrString || p.qr_string)}</pre>`;
    const dl = p.deeplink || p.openAbaUrl || p.payUrl;
    const a = $("#qrDeeplink");
    if (dl) { a.href = dl; a.classList.remove("hidden"); } else a.classList.add("hidden");
    $("#qrStatus").textContent = "Waiting for payment…";
    $("#qr-dialog").showModal();
    stopPoll();
    S.pollTimer = setInterval(checkPaid, 5000);
  }

  function stopPoll() { if (S.pollTimer) clearInterval(S.pollTimer); S.pollTimer = null; }

  async function checkPaid() {
    if (!S.checkoutId) return;
    const r = await api(`/api/checkout/${encodeURIComponent(S.checkoutId)}/status`);
    const order = r.data && r.data.order;
    if (order && order.status && order.status !== "pending") {
      stopPoll();
      $("#qr-dialog").close();
      toast("Payment received ✓");
      location.hash = "#/success/" + encodeURIComponent(S.checkoutId);
    } else {
      $("#qrStatus").textContent = "Payment not received yet";
    }
  }

  function renderSuccess(id) {
    app.innerHTML = `<section class="mt-6 rounded-2xl p-6 bg-daddy-dark-purple border border-daddy-light-purple/20 text-center">
      <h1 class="text-xl font-extrabold text-primary">Payment successful</h1>
      <p class="mt-2 text-daddy-text-darker">Order ${esc(id)} — your top-up is being processed.</p>
      <a href="#/" class="inline-block mt-4 px-5 py-2 rounded-full bg-daddy-orange text-daddy-dark-purple font-bold">Back to home</a></section>`;
  }

  /* ---------- Router ---------- */
  function route() {
    stopPoll();
    const h = location.hash || "#/";
    const m = h.match(/^#\/game\/(.+)$/);
    const s = h.match(/^#\/success\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      const g = S.games.find((x) => String(x.id) === id);
      if (S.game?.id !== id) {
        S.game = g || null;
        S.pack = null; S.qty = 1; S.discount = 0; S.couponMsg = ""; S.coupon = ""; S.payErr = ""; S.check = null; S.checkErr = "";
        S.userId = S.userId || ""; S.zoneId = ""; S.server = ""; S.checkoutId = null;
      }
      if (!g) return S.loaded ? (app.innerHTML = `<p class="py-12 text-center">Game not found.</p>`) : undefined;
      window.scrollTo(0, 0);
      renderGame();
      return;
    }
    if (s) { renderSuccess(decodeURIComponent(s[1])); return; }
    if (h === "#/terms") { renderTerms(); return; }
    S.game = null;
    renderHome();
  }

  /* ---------- Catalog ---------- */
  async function loadCatalog() {
    const r = await api("/api/catalog");
    S.games = Array.isArray(r.data.games) ? r.data.games : [];
    S.loaded = true;
    route();
  }

  /* ---------- Login (Telegram widget, same flow as the React app) ---------- */
  function setLoggedIn(user) {
    S.user = user || null;
    const label = $("#loginLabel");
    const icon = $("#loginIcon");
    if (S.user) {
      label.textContent = S.user.first_name || S.user.username || "Account";
      icon.className = "fas fa-check";
    } else {
      label.textContent = "Login";
      icon.className = "fas fa-user";
    }
  }

  async function loadMe() {
    const r = await api("/api/auth/me");
    if (r.data && r.data.ok && r.data.user) setLoggedIn(r.data.user);
  }

  async function openLogin() {
    const dlg = $("#customer-login-dialog");
    dlg.showModal();
    $("#loginErr").hidden = true;
    const box = $("#tg-login-widget");
    box.innerHTML = "";
    const cfg = await api("/api/auth/telegram/config");
    const bot = String((cfg.data && cfg.data.botUsername) || "").replace(/^@/, "").trim();
    if (!bot) {
      $("#tgHint").textContent = "Telegram login is not configured yet.";
      return;
    }
    const origin = location.origin;
    const authUrl = `${origin}/api/auth/telegram/callback`;
    const iframe = document.createElement("iframe");
    iframe.src = `https://oauth.telegram.org/embed/${encodeURIComponent(bot)}?origin=${encodeURIComponent(origin)}&size=large&request_access=write&return_to=${encodeURIComponent(authUrl)}`;
    iframe.width = "100%"; iframe.height = "48"; iframe.frameBorder = "0"; iframe.scrolling = "no";
    iframe.setAttribute("title", "Telegram Login");
    iframe.style.cssText = "border:0;overflow:hidden;width:100%;height:48px;display:block;";
    box.appendChild(iframe);
    const sc = document.createElement("script");
    sc.src = "https://telegram.org/js/telegram-widget.js?22";
    sc.async = true;
    sc.setAttribute("data-telegram-login", bot);
    sc.setAttribute("data-size", "large");
    sc.setAttribute("data-radius", "12");
    sc.setAttribute("data-auth-url", authUrl);
    sc.setAttribute("data-request-access", "write");
    box.appendChild(sc);
  }

  window.onTelegramAuth = async (user) => {
    const r = await api("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!r.ok || !r.data.ok) {
      const e = $("#loginErr"); e.textContent = r.data.error || "Login failed"; e.hidden = false; return;
    }
    setLoggedIn(r.data.user);
    $("#customer-login-dialog").close();
    toast("Logged in ✓");
    S.games = []; loadCatalog();
  };

  /* ---------- Wiring ---------- */
  $("#loginOpen").onclick = () => {
    if (S.user) {
      if (confirm("Log out?")) api("/api/auth/logout", { method: "POST" }).then(() => { setLoggedIn(null); toast("Logged out"); });
      return;
    }
    openLogin();
  };
  $("#loginClose").onclick = () => $("#customer-login-dialog").close();
  $("#qrClose").onclick = () => { stopPoll(); $("#qr-dialog").close(); };
  $("#qrCheck").onclick = checkPaid;
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  $("#q").oninput = (e) => { S.query = e.target.value; if (location.hash !== "#/" && !location.hash.startsWith("#/game")) location.hash = "#/"; renderHome(); };
  $("#mSearchBtn").onclick = () => { $("#mSearch").classList.remove("hidden"); setTimeout(() => $("#mq").focus(), 50); };
  $("#mSearchClose").onclick = () => $("#mSearch").classList.add("hidden");
  $("#mq").oninput = (e) => { S.query = e.target.value; $("#q").value = S.query; if (!location.hash.startsWith("#/game")) renderHome(); };

  window.addEventListener("hashchange", route);
  loadMe();
  loadCatalog();
  setInterval(() => { if (!S.game && location.hash === "#/" && !S.query) loadCatalog(); }, 60000);
})();
