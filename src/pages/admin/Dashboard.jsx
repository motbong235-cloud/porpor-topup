import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AIcon, PageHead, StatusBadge, STATUS, api, timeAgo, usd } from "./ui";

const DAY_KM = ["អា", "ច", "អ", "ព", "ព្រ", "សុ", "ស"];

function Stat({ icon, label, value, sub, tone = "blue" }) {
  return (
    <div className="ad-stat">
      <span className={`ad-stat-ico ${tone}`}>
        <AIcon name={icon} size={20} />
      </span>
      <div>
        <div className="ad-stat-label">{label}</div>
        <div className="ad-stat-value">{value}</div>
        {sub ? <div className="ad-stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

function Dot({ ok }) {
  return <span className={`ad-dot ${ok ? "ok" : "bad"}`} />;
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [recent, setRecent] = useState([]);
  const [integ, setInteg] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then(setS)
      .catch(() => setErr("មិនអាចទាញទិន្នន័យបានទេ"));
    api("/api/admin/orders")
      .then((l) => setRecent(l.slice(0, 6)))
      .catch(() => {});
    api("/api/admin/integrations")
      .then(setInteg)
      .catch(() => setInteg({ error: "unreachable" }));
  }, []);

  if (err) return <p className="ad-error">{err}</p>;
  if (!s) return <div className="ad-loading"><span className="ad-spin" /> កំពុងផ្ទុក…</div>;

  const maxRev = Math.max(1, ...s.daily.map((d) => d.revenue));

  return (
    <div>
      <PageHead km="ផ្ទាំងគ្រប់គ្រង" en="Overview of orders, revenue and system status" />

      <div className="ad-stats">
        <Stat icon="money" tone="blue" label="ចំណូលសរុប" value={usd(s.revenue)} sub="ការបញ្ជាទិញជោគជ័យ" />
        <Stat icon="trend" tone="green" label="ប្រាក់ចំណេញ" value={usd(s.profit)} sub="ចំណូល − តម្លៃដើម" />
        <Stat icon="box" tone="violet" label="ការបញ្ជាទិញ" value={s.totalOrders} sub={`ថ្ងៃនេះ ${s.todayOrders}`} />
        <Stat icon="clock" tone="amber" label="រង់ចាំបង់ប្រាក់" value={s.pending} sub="មិនទាន់បង់" />
      </div>

      <div className="ad-grid2">
        <section className="ad-card">
          <h2>ចំណូល ៧ ថ្ងៃចុងក្រោយ</h2>
          <div className="ad-chart">
            {s.daily.map((d) => {
              const day = new Date(d.date);
              return (
                <div key={d.date} className="ad-bar" title={`${usd(d.revenue)} · ${d.orders} orders`}>
                  <span className="ad-bar-val">{d.revenue ? usd(d.revenue).replace(".00", "") : ""}</span>
                  <div className="ad-bar-col">
                    <i style={{ height: `${Math.max(d.revenue ? 6 : 2, (d.revenue / maxRev) * 100)}%` }} />
                  </div>
                  <span className="ad-bar-lbl">{DAY_KM[day.getDay()]}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ad-card">
          <h2>ស្ថានភាពប្រព័ន្ធ</h2>
          {!integ ? (
            <div className="ad-loading"><span className="ad-spin" /></div>
          ) : (
            <ul className="ad-status-list">
              <li>
                <Dot ok={integ.paymentReady} />
                <span>ការទូទាត់ KHQR</span>
                <b>{integ.paymentReady ? "ភ្ជាប់រួច" : "មិនទាន់កំណត់"}</b>
              </li>
              <li>
                <Dot ok={integ.topupReady && !integ.error} />
                <span>Khmer TopUp</span>
                <b>{integ.topupReady ? (integ.error ? "មានបញ្ហា" : "ភ្ជាប់រួច") : "មិនទាន់កំណត់"}</b>
              </li>
              {integ.topupReady && !integ.error ? (
                <>
                  <li>
                    <AIcon name="wallet" size={14} />
                    <span>សមតុល្យ Supplier</span>
                    <b>{integ.balance != null ? usd(integ.balance) : "—"}</b>
                  </li>
                  <li>
                    <AIcon name="box" size={14} />
                    <span>ហ្គេមមានលើ Supplier</span>
                    <b>{integ.gamesCount ?? "—"}</b>
                  </li>
                </>
              ) : null}
            </ul>
          )}
          {integ?.error && integ.topupReady ? <p className="ad-hint bad">{String(integ.error)}</p> : null}
          <Link to="/admin/services" className="ad-btn soft block">
            <AIcon name="services" size={16} /> គ្រប់គ្រងសេវាហ្គេម
          </Link>
        </section>
      </div>

      <section className="ad-card">
        <div className="ad-card-head">
          <h2>ការបញ្ជាទិញថ្មីៗ</h2>
          <Link to="/admin/orders" className="ad-link-sm">មើលទាំងអស់ →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="ad-empty">មិនទាន់មានការបញ្ជាទិញនៅឡើយទេ</p>
        ) : (
          <ul className="ad-recent">
            {recent.map((o) => (
              <li key={o.id}>
                <div>
                  <strong>{o.gameName}</strong>
                  <small>
                    {o.packName} × {o.qty} · {o.userId}
                  </small>
                </div>
                <div className="ad-recent-r">
                  <b>{usd(o.total)}</b>
                  <StatusBadge status={o.status || "delivered"} />
                  <small>{timeAgo(o.createdAt)}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="ad-mini-stats">
          {Object.keys(STATUS).map((k) => (
            <span key={k}>
              <StatusBadge status={k} /> {s.byStatus?.[k] || 0}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
