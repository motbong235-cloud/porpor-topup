import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./AdminLayout";

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then(setS)
      .catch(() => setErr("Could not load stats"));
  }, []);

  if (err) return <p style={{ color: "var(--danger)" }}>{err}</p>;
  if (!s) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 8 }}>
        Dashboard
      </h1>
      <p className="page-lead" style={{ marginBottom: 20 }}>
        Overview of Porpor TOPUP orders and revenue (demo).
      </p>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Total orders</div>
          <div className="value">{s.totalOrders}</div>
        </div>
        <div className="stat-card">
          <div className="label">Today</div>
          <div className="value">{s.todayOrders}</div>
        </div>
        <div className="stat-card">
          <div className="label">Revenue</div>
          <div className="value">${Number(s.revenue).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending</div>
          <div className="value">{s.pending}</div>
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn bg-brand" to="/admin/orders">
          Manage orders
        </Link>
        <Link className="btn-soft" to="/admin/settings" style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 16px", borderRadius: 999 }}>
          Full settings
        </Link>
      </div>
    </div>
  );
}
