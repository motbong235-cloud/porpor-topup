import { useCallback, useEffect, useMemo, useState } from "react";
import { AIcon, PageHead, StatusBadge, STATUS, api, toast, usd } from "./ui";

const FILTERS = [["", "ទាំងអស់"], ...Object.entries(STATUS).map(([k, v]) => [k, v.km])];

export default function OrdersAdmin() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api("/api/admin/orders"));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { "": list.length };
    for (const o of list) c[o.status || "delivered"] = (c[o.status || "delivered"] || 0) + 1;
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((o) => {
      if (status && (o.status || "delivered") !== status) return false;
      if (!s) return true;
      return [o.id, o.userId, o.gameName, o.nickname, o.packName].some((v) => String(v || "").toLowerCase().includes(s));
    });
  }, [list, q, status]);

  async function patch(id, body, okMsg) {
    setBusy(id);
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast(okMsg);
      await load();
    } catch {
      toast("សកម្មភាពមិនបានជោគជ័យ", "bad");
    } finally {
      setBusy("");
    }
  }

  async function remove(id) {
    if (!confirm(`លុបការបញ្ជាទិញ ${id} ?`)) return;
    try {
      await api(`/api/admin/orders/${id}`, { method: "DELETE" });
      toast("បានលុប");
      load();
    } catch {
      toast("លុបមិនបាន", "bad");
    }
  }

  return (
    <div>
      <PageHead km="ការបញ្ជាទិញ" en="Search, review and fix orders">
        <button type="button" className="ad-btn soft" onClick={load}>
          <AIcon name="refresh" size={16} /> ផ្ទុកឡើងវិញ
        </button>
      </PageHead>

      <div className="ad-search">
        <AIcon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ស្វែងរក កូដ / Player ID / ហ្គេម / ឈ្មោះ…" />
      </div>

      <div className="ad-chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`ad-chip${status === k ? " active" : ""}`} onClick={() => setStatus(k)}>
            {label} <em>{counts[k] || 0}</em>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ad-loading"><span className="ad-spin" /> កំពុងផ្ទុក…</div>
      ) : shown.length === 0 ? (
        <p className="ad-empty card">រកមិនឃើញការបញ្ជាទិញទេ</p>
      ) : (
        <div className="ad-orders">
          {shown.map((o) => {
            const st = o.status || "delivered";
            const isOpen = open === o.id;
            const canRetry = st === "paid" || (st === "failed" && o.paidAt);
            const canDeliver = st === "paid" || st === "processing" || (st === "failed" && o.paidAt);
            const profit = (Number(o.total) || 0) - (Number(o.cost) || 0);
            return (
              <article key={o.id} className={`ad-order${isOpen ? " open" : ""}`}>
                <button type="button" className="ad-order-row" onClick={() => setOpen(isOpen ? "" : o.id)}>
                  <span className="mono">{o.id}</span>
                  <span className="ad-order-game">
                    <strong>{o.gameName}</strong>
                    <small>
                      {o.packName} × {o.qty}
                    </small>
                  </span>
                  <span className="ad-order-player">
                    {o.nickname || "—"}
                    <small>
                      {o.userId}
                      {o.zoneId ? ` (${o.zoneId})` : ""}
                    </small>
                  </span>
                  <b>{usd(o.total)}</b>
                  <StatusBadge status={st} />
                  <span className="ad-order-time">{new Date(o.createdAt).toLocaleString()}</span>
                  <span className="ad-chev">
                    <AIcon name="chevron" size={16} />
                  </span>
                </button>

                {isOpen ? (
                  <div className="ad-order-detail">
                    <dl>
                      <div><dt>ចំណូល</dt><dd>{usd(o.total)}{o.discount ? ` (បញ្ចុះ ${usd(o.discount)})` : ""}</dd></div>
                      <div><dt>តម្លៃដើម</dt><dd>{o.cost != null ? usd(o.cost) : "—"}</dd></div>
                      <div><dt>ចំណេញ</dt><dd className={profit >= 0 ? "pos" : "neg"}>{o.cost != null ? usd(profit) : "—"}</dd></div>
                      <div><dt>Coupon</dt><dd>{o.coupon || "—"}</dd></div>
                      <div><dt>Supplier order</dt><dd className="mono">{(o.ktOrderCodes || (o.ktOrderCode ? [o.ktOrderCode] : [])).join(", ") || "—"}</dd></div>
                      <div><dt>បានបង់នៅ</dt><dd>{o.paidAt ? new Date(o.paidAt).toLocaleString() : "មិនទាន់បង់"}</dd></div>
                    </dl>
                    {o.note ? <p className="ad-note">{o.note}</p> : null}
                    <div className="ad-actions">
                      {canRetry ? (
                        <button type="button" className="ad-btn primary" disabled={busy === o.id} onClick={() => patch(o.id, { fulfill: true }, "បានបញ្ជូនទៅ Khmer TopUp ម្តងទៀត")}>
                          <AIcon name="bolt" size={15} /> បញ្ចូលហ្គេមម្តងទៀត
                        </button>
                      ) : null}
                      {canDeliver ? (
                        <button
                          type="button"
                          className="ad-btn soft"
                          disabled={busy === o.id}
                          onClick={() => confirm("កំណត់ជា «ជោគជ័យ» ដោយដៃ?") && patch(o.id, { status: "delivered" }, "បានកំណត់ជាជោគជ័យ")}
                        >
                          <AIcon name="check" size={15} /> កំណត់ជាជោគជ័យ
                        </button>
                      ) : null}
                      <button type="button" className="ad-btn danger" onClick={() => remove(o.id)}>
                        <AIcon name="trash" size={15} /> លុប
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
