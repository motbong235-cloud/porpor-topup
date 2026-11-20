(() => {
  const TG_FALLBACK = "https://t.me/porportopup";

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
          <input id="pp-lc-input" type="text" maxlength="500" placeholder="សរសេរសារ…" autocomplete="off" required />
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

    let sessionId = sessionStorage.getItem("pp_chat_sid") || "";
    const msgs = el.querySelector("#pp-lc-msgs");
    const form = el.querySelector("#pp-lc-form");
    const input = el.querySelector("#pp-lc-input");

    function addBubble(text, who) {
      const d = document.createElement("div");
      d.className = "pp-lc-bubble " + who;
      d.textContent = text;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
    }

    async function ensureSession() {
      if (sessionId) return sessionId;
      try {
        const r = await fetch("/api/chat/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const d = await r.json().catch(() => ({}));
        sessionId = d.sessionId || d.id || d.threadId || "";
        if (sessionId) sessionStorage.setItem("pp_chat_sid", sessionId);
      } catch (_) {}
      return sessionId;
    }

    async function loadMessages() {
      const sid = await ensureSession();
      if (!sid) return;
      try {
        const r = await fetch("/api/chat/messages?sessionId=" + encodeURIComponent(sid), {
          credentials: "same-origin",
        });
        const d = await r.json().catch(() => ({}));
        const list = d.messages || d.items || [];
        msgs.innerHTML = "";
        if (!list.length) {
          addBubble("សួស្តី! សរសេរសារមក Admin នៅទីនេះ។", "them");
        }
        list.forEach((m) => {
          const who = m.from === "admin" || m.role === "admin" ? "them" : "me";
          addBubble(m.text || m.body || m.message || "", who);
        });
      } catch (_) {
        addBubble("សួស្តី! សរសេរសារមក Admin នៅទីនេះ។", "them");
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      addBubble(text, "me");
      const sid = await ensureSession();
      try {
        await fetch("/api/chat/messages", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, text, message: text }),
        });
      } catch (_) {}
    });

    el._open = () => {
      el.classList.add("open");
      loadMessages();
      setTimeout(() => input.focus(), 100);
    };

    // settings telegram link
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        const url = (s && (s.telegram || s.telegramUrl)) || TG_FALLBACK;
        const a = el.querySelector("#pp-lc-tg");
        if (a && url) a.href = url.startsWith("http") ? url : "https://t.me/" + String(url).replace(/^@/, "");
        // also update floating menu telegram
        document.querySelectorAll('[data-support-contact="telegram"]').forEach((node) => {
          if (url) node.href = url.startsWith("http") ? url : "https://t.me/" + String(url).replace(/^@/, "");
        });
      })
      .catch(() => {});

    return el;
  }

  function openLiveChat(e) {
    if (e) e.preventDefault();
    const panel = ensurePanel();
    // close support menu
    document.querySelectorAll("[data-support-widget]").forEach((w) => {
      w.dataset.open = "false";
      const menu = w.querySelector("[data-support-menu]");
      if (menu) menu.hidden = true;
    });
    panel._open();
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-support-contact="livechat"], #pp-open-livechat');
    if (a) openLiveChat(e);
  });
})();
