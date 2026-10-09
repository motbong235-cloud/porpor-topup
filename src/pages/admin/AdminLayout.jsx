import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AIcon, api } from "./ui";
import "./Admin.css";

export { api };

const NAV = [
  { to: "/admin", end: true, icon: "dashboard", km: "ផ្ទាំងគ្រប់គ្រង", en: "Dashboard" },
  { to: "/admin/orders", icon: "orders", km: "ការបញ្ជាទិញ", en: "Orders" },
  { to: "/admin/services", icon: "services", km: "សេវាហ្គេម", en: "Services" },
  { to: "/admin/settings", icon: "settings", km: "ការកំណត់", en: "Settings" },
];

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

export default function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/admin/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
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
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      setAuthed(true);
      setPassword("");
    } catch {
      setErr("ពាក្យសម្ងាត់មិនត្រឹមត្រូវ");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
    } catch {}
    setAuthed(false);
    navigate("/admin");
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
        <form className="ad-login-box" onSubmit={login}>
          <div className="ad-logo">PP</div>
          <h1>
            Porpor <span>Admin</span>
          </h1>
          <p>តំបន់គ្រប់គ្រងឯកជន · Private admin panel</p>
          <label>
            ពាក្យសម្ងាត់ / Password
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
        <Link to="/admin" className="ad-brand">
          <span className="ad-logo sm">PP</span>
          <span>
            Porpor <b>Admin</b>
          </span>
        </Link>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="ad-link">
              <AIcon name={n.icon} />
              <span>
                {n.km}
                <small>{n.en}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="ad-side-foot">
          <Link to="/" className="ad-link">
            <AIcon name="store" />
            <span>
              ទៅកាន់ហាង<small>View store</small>
            </span>
          </Link>
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
          <Link to="/admin" className="ad-brand">
            <span className="ad-logo sm">PP</span>
            <span>
              Porpor <b>Admin</b>
            </span>
          </Link>
          <div className="ad-mbar-actions">
            <Link to="/" aria-label="Store">
              <AIcon name="store" />
            </Link>
            <button type="button" onClick={logout} aria-label="Logout">
              <AIcon name="logout" />
            </button>
          </div>
        </header>
        <main className="ad-content">
          <Outlet />
        </main>
      </div>

      <nav className="ad-tabs">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <AIcon name={n.icon} size={20} />
            <span>{n.km}</span>
          </NavLink>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
