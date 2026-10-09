import { useCallback, useEffect, useState } from "react";
import { api } from "./AdminLayout";

export default function OrdersAdmin() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const data = await api(`/api/admin/orders?${params}`);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function setOrderStatus(id, next) {
    await api(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm(`Delete order ${id}?`)) return;
    await api(`/api/admin/orders/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <p className="page-lead">Search, update status, or delete orders.</p>
      <div className="admin-toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, ID, game…" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="delivered">Delivered</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button type="button" className="btn-soft" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Game</th>
              <th>Player</th>
              <th>Total</th>
              <th>Method</th>
              <th>Status</th>
              <th>When</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--muted)" }}>
                  Loading…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--muted)" }}>
                  No orders yet
                </td>
              </tr>
            ) : (
              list.map((o) => {
                const st = o.status || "delivered";
                return (
                  <tr key={o.id}>
                    <td className="mono">{o.id}</td>
                    <td>
                      {o.gameName}
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {o.packName} × {o.qty}
                      </div>
                    </td>
                    <td>
                      {o.nickname || "—"}
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {o.userId}
                        {o.zoneId ? ` (${o.zoneId})` : ""}
                      </div>
                    </td>
                    <td>${Number(o.total).toFixed(2)}</td>
                    <td>{o.method === "wallet" ? "Wallet" : "KHQR"}</td>
                    <td>
                      <span className={`badge ${st === "delivered" ? "ok" : st === "pending" ? "warn" : "bad"}`}>
                        {st}
                      </span>
                    </td>
                    <td>{new Date(o.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="admin-actions">
                        {st !== "delivered" && (
                          <button type="button" onClick={() => setOrderStatus(o.id, "delivered")}>
                            Deliver
                          </button>
                        )}
                        {st !== "pending" && (
                          <button type="button" onClick={() => setOrderStatus(o.id, "pending")}>
                            Pending
                          </button>
                        )}
                        <button type="button" className="danger" onClick={() => remove(o.id)}>
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
