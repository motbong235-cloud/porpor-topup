(() => {
  const TG_FALLBACK = "https://t.me/porportopupi";

  function ensurePanel() {
    let el = document.getElementById("pp-livechat-panel");
    if (el) return el;

    el = document.createElement("div");
    el.id = "pp-livechat-panel";
    el.innerHTML = `
      <div class="pp-lc-backdrop" data-pp-lc-close></div>
      <div class="pp-lc-sheet" role="dialog" aria-label="Live Chat">
        <header class="pp-lc-head">
          <div>
            <strong>Live Chat</strong>
            <p>POR POR TOPUP Support</p>
          </div>
          <button type="button" class="pp-lc-x" data-pp-lc-close aria-label="Close">×</button>
        </header>
        <div class="pp-lc-msgs" id="pp-lc-msgs"></div>
        <form class="pp-lc-form" id="pp-lc-form">
          <input id="pp-lc-input" type="text" maxlength="2000" placeholder="សរសេរសារ…" autocomplete="off" required />
          <button type="submit">ផ្ញើ</button>
        </form>
        <a class="pp-lc-tg" id="pp-lc-tg" href="${TG_FALLBACK}" target="_blank" rel="noopener">Telegram ផ្ទាល់ →</a>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      #pp-livechat-panel{position:fixed;inset:0;z-index:99999;display:none;align-items:flex-end;justify-content:flex-end}
      #pp-livechat-panel.open{display:flex}
      .pp-lc-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}
      .pp-lc-sheet{position:relative;z-index:1;width:min(100%,380px);max-height:78vh;margin:0 12px 12px;background:#1a1614;border:1px solid rgba(242,165,26,.35);border-radius:16px 16px 12px 12px;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.5);overflow:hidden}
      .pp-lc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#242121;border-bottom:1px solid rgba(242,165,26,.2)}
      .pp-lc-head strong{color:#ffd447;font-size:15px}
      .pp-lc-head p{margin:2px 0 0;color:#ebd6b6;font-size:11px;opacity:.85}
      .pp-lc-x{background:transparent;border:0;color:#ebd6b6;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}
      .pp-lc-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:180px}
      .pp-lc-bubble{max-width:85%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
      .pp-lc-bubble.me{align-self:flex-end;background:linear-gradient(90deg,#f2a51a,#ffd447);color:#1a1412}
      .pp-lc-bubble.them{align-self:flex-start;background:#2d2a29;color:#fff7e5;border:1px solid rgba(255,255,255,.08)}
      .pp-lc-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(242,165,26,.15);background:#242121}
      .pp-lc-form input{flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#1a1614;color:#fff7e5;padding:10px 12px;font-size:14px}
      .pp-lc-form button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;background:linear-gradient(90deg,#f2a51a,#ffd447);color:#1a1412;cursor:pointer}
      .pp-lc-tg{display:block;text-align:center;padding:8px;font-size:12px;font-weight:700;color:#ffd447;text-decoration:none;border-top:1px solid rgba(242,165,26,.12)}
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);

    el.querySelectorAll("[data-pp-lc-close]").forEach((b) =>
      b.addEventListener("click", () => el.classList.remove("open")),
    );

    const msgs = el.querySelector("#pp-lc-msgs");
    const form = el.querySelector("#pp-lc-form");
    const input = el.querySelector("#pp-lc-input");
    let lastAfter = 0;
    let pollTimer = null;

    function addBubble(text, who) {
      if (!text) return;
      const d = document.createElement("div");
      d.className = "pp-lc-bubble " + who;
      d.textContent = text;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function renderList(list, clear) {
      if (clear) msgs.innerHTML = "";
      if (!list || !list.length) {
        if (clear) addBubble("សួស្តី! សរសេរសារមក Admin នៅទីនេះ។ ឬចុច Telegram ខាងក្រោម។", "them");
        return;
      }
      list.forEach((m) => {
        const role = String(m.from || m.role || m.sender || "").toLowerCase();
        const who = role === "admin" || role === "staff" || role === "agent" ? "them" : "me";
        const text = m.text || m.body || m.message || "";
        if (text) addBubble(text, who);
        if (m.at || m.id) lastAfter = Math.max(lastAfter, Number(m.at || m.id) || 0);
      });
    }

    async function openSession() {
      try {
        const r = await fetch("/api/chat/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const d = await r.json().catch(() => ({}));
        // API returns { visitorId, messages }
        renderList(d.messages || [], true);
      } catch (_) {
        renderList([], true);
      }
    }

    async function poll() {
      try {
        const q = lastAfter ? "?after=" + encodeURIComponent(lastAfter) : "";
        const r = await fetch("/api/chat/messages" + q, { credentials: "same-origin" });
        if (!r.ok) return;
        const d = await r.json().catch(() => ({}));
        const list = d.messages || d.items || (Array.isArray(d) ? d : []);
        if (list.length) renderList(list, false);
      } catch (_) {}
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      addBubble(text, "me");
      try {
        await fetch("/api/chat/messages", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", text }),
        });
      } catch (_) {
        addBubble("ផ្ញើមិនបាន — សូមសាក Telegram", "them");
      }
    });

    el._open = () => {
      el.classList.add("open");
      openSession().then(() => {
        clearInterval(pollTimer);
        pollTimer = setInterval(poll, 4000);
      });
      setTimeout(() => input.focus(), 120);
    };

    el._close = () => {
      el.classList.remove("open");
      clearInterval(pollTimer);
    };

    el.querySelectorAll("[data-pp-lc-close]").forEach((b) =>
      b.addEventListener("click", () => el._close()),
    );

    // Telegram from settings
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        let url = (s && (s.telegram || s.telegramUrl)) || TG_FALLBACK;
        if (url && !/^https?:\/\//i.test(url)) url = "https://t.me/" + String(url).replace(/^@/, "");
        const a = el.querySelector("#pp-lc-tg");
        if (a && url) a.href = url;
        document.querySelectorAll('[data-support-contact="telegram"]').forEach((node) => {
          if (url) node.href = url;
        });
      })
      .catch(() => {});

    return el;
  }

  function openLiveChat(e) {
    if (e) e.preventDefault();
    document.querySelectorAll("[data-support-widget]").forEach((w) => {
      w.dataset.open = "false";
      const menu = w.querySelector("[data-support-menu]");
      if (menu) menu.hidden = true;
      const trigger = w.querySelector("[data-support-trigger]");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
    ensurePanel()._open();
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-support-contact="livechat"], #pp-open-livechat');
    if (a) openLiveChat(e);
  });
})();
