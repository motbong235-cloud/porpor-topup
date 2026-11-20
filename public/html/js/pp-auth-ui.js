/**
 * Show Telegram account in header after login (cookie porpor_tg is httpOnly → /api/auth/me).
 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function nameOf(u) {
    if (!u) return "";
    if (u.username) return "@" + String(u.username).replace(/^@/, "");
    const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return n || "Account";
  }

  function paint(user) {
    const actions = $$(".customer-login-action, a[data-customer-login-open], a.customer-login-action");
    if (!actions.length) return;

    if (!user) {
      actions.forEach((a) => {
        a.classList.remove("is-signed-in");
        const label = a.querySelector(".customer-login-action__label");
        if (label) label.textContent = "Login";
        a.setAttribute("href", a.getAttribute("data-login-href") || "/login");
        a.onclick = null;
      });
      return;
    }

    actions.forEach((a) => {
      if (!a.getAttribute("data-login-href")) {
        a.setAttribute("data-login-href", a.getAttribute("href") || "/login");
      }
      a.classList.add("is-signed-in");
      a.setAttribute("href", "#account");
      a.setAttribute("title", nameOf(user));
      const label = a.querySelector(".customer-login-action__label");
      if (label) {
        label.textContent = nameOf(user);
      } else {
        // rebuild core if structure differs
        const core = a.querySelector(".customer-login-action__core");
        if (core && !core.querySelector(".customer-login-action__label")) {
          const span = document.createElement("span");
          span.className = "customer-login-action__label";
          span.textContent = nameOf(user);
          core.appendChild(span);
        }
      }
      // photo
      let icon = a.querySelector(".customer-login-action__icon");
      if (icon && user.photo_url) {
        icon.innerHTML = "";
        icon.style.cssText =
          "display:inline-grid;place-items:center;width:1.35rem;height:1.35rem;border-radius:999px;overflow:hidden;background:#242121";
        const img = document.createElement("img");
        img.src = user.photo_url;
        img.alt = "";
        img.width = 22;
        img.height = 22;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:999px";
        img.referrerPolicy = "no-referrer";
        icon.appendChild(img);
      }
      a.onclick = (e) => {
        e.preventDefault();
        openMenu(user, a);
      };
    });
  }

  function openMenu(user, anchor) {
    let menu = document.getElementById("pp-account-menu");
    if (menu) menu.remove();
    menu = document.createElement("div");
    menu.id = "pp-account-menu";
    menu.innerHTML = `
      <div class="pp-acc-card">
        <div class="pp-acc-row">
          ${user.photo_url ? `<img class="pp-acc-av" src="${user.photo_url}" alt="" referrerpolicy="no-referrer">` : `<span class="pp-acc-av pp-acc-ph"></span>`}
          <div>
            <strong>${nameOf(user)}</strong>
            <p>${user.first_name || ""} ${user.last_name || ""}</p>
          </div>
        </div>
        <button type="button" id="pp-acc-logout">Logout</button>
      </div>`;
    const st = document.createElement("style");
    st.textContent = `
      #pp-account-menu{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:flex-end;padding:64px 12px 12px}
      .pp-acc-card{background:#1a1614;border:1px solid rgba(242,165,26,.35);border-radius:14px;padding:14px;min-width:220px;max-width:92vw;box-shadow:0 16px 40px rgba(0,0,0,.45)}
      .pp-acc-row{display:flex;gap:10px;align-items:center;margin-bottom:12px}
      .pp-acc-av{width:40px;height:40px;border-radius:999px;object-fit:cover}
      .pp-acc-ph{background:linear-gradient(145deg,#FFD447,#F2A51A);display:inline-block}
      .pp-acc-card strong{color:#ffd447;font-size:14px}
      .pp-acc-card p{margin:2px 0 0;color:#ebd6b6;font-size:12px}
      #pp-acc-logout{width:100%;border:0;border-radius:10px;padding:10px;font-weight:800;cursor:pointer;background:#2d2a29;color:#fff7e5;border:1px solid rgba(255,255,255,.1)}
    `;
    menu.appendChild(st);
    document.body.appendChild(menu);
    menu.addEventListener("click", (e) => {
      if (e.target === menu) menu.remove();
    });
    menu.querySelector("#pp-acc-logout").onclick = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      } catch (_) {}
      menu.remove();
      paint(null);
      location.reload();
    };
  }

  async function refresh() {
    try {
      const r = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json();
      paint(d && d.ok && d.user ? d.user : null);
      if (d && d.ok && d.user) {
        document.documentElement.dataset.tgUser = String(d.user.id || "");
      }
    } catch (_) {
      paint(null);
    }
  }

  // After redirect ?tg_login=ok
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("tg_login") === "ok") {
      q.delete("tg_login");
      const clean = location.pathname + (q.toString() ? "?" + q : "") + location.hash;
      history.replaceState(null, "", clean);
    }
  } catch (_) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }
  window.ppRefreshAuth = refresh;
})();
