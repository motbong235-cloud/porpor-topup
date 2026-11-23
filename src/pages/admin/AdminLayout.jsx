import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AIcon, api } from "./ui";
import "./Admin.css";
import "./AdminTheme.css";
import "./AdminPro.css";

export { api };

/** Build id — if you see this text on login, new frontend is live (no 2FA). */
const BUILD_TAG = "no2fa-2026-10-11";

export default function AdminLayout({ adminPath = "pp-console" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = `/${String(adminPath || "pp-console").replace(/^\/+|\/+$/g, "")}`;
  const NAV = [
    { g: "ទូទៅ", to: base, end: true, icon: "dashboard", km: "ផ្ទាំង", en: "Dashboard", tab: "ផ្ទាំង" },
    { g: "លក់", to: `${base}/orders`, icon: "orders", km: "ការបញ្ជាទិញ", en: "Orders", tab: "Order" },
    { g: "កាតាឡុក", to: `${base}/services`, icon: "services", km: "សេវាហ្គេម", en: "Services", tab: "សេវា" },
    { g: "គាំទ្រ", to: `${base}/chat`, icon: "send", km: "Live Chat", en: "Live Chat", tab: "Chat" },
    { g: "ប្រព័ន្ធ", to: `${base}/settings`, icon: "settings", km: "ការកំណត់", en: "Settings", tab: "Settings" },
    // secondary — mobile "More" menu
    { to: `${base}/special-items`, icon: "star", km: "★ កញ្ចប់ពិសេស", en: "★ Special packs", more: true },
    { to: `${base}/tiktok-khmer`, icon: "services", km: "TikTok Khmer", en: "TikTok packs", more: true },
    { to: `${base}/prices`, icon: "orders", km: "តាមដានតម្លៃ", en: "Prices", more: true },
  ];
  const TAB_NAV = NAV.filter((n) => !n.more);
  const MORE_NAV = NAV.filter((n) => n.more);

  useEffect(() => {
    document.documentElement.classList.add("ad-mode");
    return () => document.documentElement.classList.remove("ad-mode");
  }, []);

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (alive) {
        setAuthed(false);
        setReady(true);
      }
    }, 4000);
    api("/api/admin/me")
      .then(() => {
        if (alive) setAuthed(true);
      })
      .catch(() => {
        if (alive) setAuthed(false);
      })
      .finally(() => {
        clearTimeout(t);
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener("admin-unauthorized", out);
    return () => window.removeEventListener("admin-unauthorized", out);
  }, []);

  async function login(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (data?.token) {
        try { sessionStorage.setItem("pp_admin_token", data.token); } catch {}
      }
      setAuthed(true);
      setPassword("");
    } catch (e) {
      const code = e?.data?.error || e?.message || "";
      if (code === "locked") setErr("សាកល្បងច្រើនពេក — រង់ចាំបន្តិច");
      else setErr("ពាក្យសម្ងាត់មិនត្រឹមត្រូវ");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try { sessionStorage.removeItem("pp_admin_token"); } catch {}
    try {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch {}
    setAuthed(false);
    navigate(base);
  }

  if (!ready) {
    return (
      <div className="ad-login">
        <div className="ad-spin big" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="ad-login">
        <aside className="ad-login-art" aria-hidden="true">
          <div className="ad-login-art-in">
            <span className="ad-logo">PP</span>
            <h2>Porpor TopUp<br />Control Center</h2>
            <p>គ្រប់គ្រងការបញ្ជាទិញ សេវាហ្គេម និង Live Chat ក្នុងកន្លែងតែមួយ។</p>
            <ul>
              <li>⚡ តាមដានការបញ្ជាទិញភ្លាមៗ</li>
              <li>💬 ឆ្លើយ Live Chat ពីអតិថិជន</li>
              <li>📈 ចំណូល និងប្រាក់ចំណេញរាល់ថ្ងៃ</li>
            </ul>
          </div>
        </aside>
        <form className="ad-login-box" onSubmit={login}>
          <div className="ad-logo">PP</div>
          <h1>
            សូមស្វាគមន៍ <span>Admin</span>
          </h1>
          <p>បញ្ចូលពាក្យសម្ងាត់ដើម្បីចូលប្រើ</p>
          <label>
            ពាក្យសម្ងាត់
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {err ? <div className="ad-login-err">{err}</div> : null}
          <button type="submit" disabled={loading || !password}>
            {loading ? "…" : "ចូលប្រើ"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="ad">
      <aside className="ad-side">
        <Link to={base} className="ad-brand">
          <span className="ad-logo sm">PP</span>
          <span>
            Porpor <b>Admin</b>
          </span>
        </Link>
        <nav>
          {NAV.map((n) => (
            <div key={n.to} className="ad-navitem">
              {n.g ? <div className="ad-navgroup">{n.g}</div> : null}
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) => (isActive ? "ad-link active" : "ad-link")}
              >
                <AIcon name={n.icon} />
                <span>
                  {n.km}
                  <small>{n.en}</small>
                </span>
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="ad-side-foot">
          <a href="/" className="ad-link">
            <AIcon name="store" />
            <span>
              ទៅកាន់ហាង<small>View store</small>
            </span>
          </a>
          <button type="button" className="ad-link" onClick={logout}>
            <AIcon name="logout" />
            <span>
              ចាកចេញ<small>Logout</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="ad-main">
        <header className="ad-mbar">
          <Link to={base} className="ad-brand">
            <span className="ad-logo sm">PP</span>
            <span>
              Porpor <b>Admin</b>
            </span>
          </Link>
          <div className="ad-mbar-actions">
            <a href="/" aria-label="Store">
              <AIcon name="store" />
            </a>
            <button type="button" onClick={logout} aria-label="Logout">
              <AIcon name="logout" />
            </button>
          </div>
        </header>
        <div className="ad-topbar">
          <div className="ad-topbar-hello">
            <b>{greet()}, Admin 👋</b>
            <small>{todayKm()}</small>
          </div>
          <div className="ad-topbar-r">
            <span className="ad-live"><i /> Online</span>
            <a href="/" className="ad-btn sm soft">
              <AIcon name="store" size={15} /> មើលហាង
            </a>
          </div>
        </div>
        <main className="ad-content">
          <Outlet />
        </main>
      </div>

      <nav className="ad-tabs" aria-label="Admin">
        {TAB_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
            onClick={() => setMoreOpen(false)}
          >
            <AIcon name={n.icon} size={20} />
            <span>{n.tab || n.km}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`ad-tabs-more-btn${moreOpen || MORE_NAV.some((n) => location.pathname.startsWith(n.to)) ? " active" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <AIcon name="dashboard" size={20} />
          <span>ផ្សេងៗ</span>
        </button>
      </nav>
      {moreOpen ? (
        <div className="ad-more-sheet" role="dialog" aria-label="More">
          <button type="button" className="ad-more-backdrop" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div className="ad-more-panel">
            <div className="ad-more-title">ម៉ឺនុយផ្សេងទៀត</div>
            {MORE_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => (isActive ? "ad-more-link active" : "ad-more-link")}
                onClick={() => setMoreOpen(false)}
              >
                <AIcon name={n.icon} size={18} />
                <span>
                  {n.km}
                  <small>{n.en}</small>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
      <Toasts />
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 11) return "អរុណសួស្តី";
  if (h < 14) return "ទិវាសួស្តី";
  if (h < 18) return "សាយណ្ហសួស្តី";
  return "សុភមង្គលរាត្រី";
}
function todayKm() {
  try {
    return new Date().toLocaleDateString("km-KH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return new Date().toDateString();
  }
}

function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    function on(e) {
      const id = Math.random().toString(36).slice(2);
      setList((l) => [...l, { id, ...e.detail }].slice(-3));
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3600);
    }
    window.addEventListener("admin-toast", on);
    return () => window.removeEventListener("admin-toast", on);
  }, []);
  return (
    <div className="ad-toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`ad-toast ${t.tone}`}>
          <AIcon name={t.tone === "bad" ? "alert" : "check"} size={16} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
