import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import "./Admin.css";

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "error"), { status: res.status, data });
  return data;
}

export { api };

export default function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/admin/me")
      .then(() => {
        setAuthed(true);
        setReady(true);
      })
      .catch(() => {
        setAuthed(false);
        setReady(true);
      });
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
      setErr("ពាក្យសម្ងាត់មិនត្រឹមត្រូវ / Wrong password");
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
      <div className="admin-login">
        <div className="box" style={{ textAlign: "center" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <form className="box" onSubmit={login}>
          <h1>
            Porpor <span className="text-brand">Admin</span>
          </h1>
          <p>Private admin panel · តំបន់គ្រប់គ្រងឯកជន</p>
          <label>
            Password
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ADMIN_PASSWORD"
            />
          </label>
          {err ? <div className="err">{err}</div> : null}
          <button type="submit" className="bg-brand" disabled={loading}>
            {loading ? "…" : "Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <Link to="/admin" className="brand">
          Porpor <span>Admin</span>
        </Link>
        <nav>
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/services">Services</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <Link to="/" style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,247,255,0.8)" }}>
          ← Store
        </Link>
        <button type="button" className="logout" onClick={logout}>
          Logout
        </button>
      </header>
      <div className="admin-body">
        <Outlet />
      </div>
    </div>
  );
}
