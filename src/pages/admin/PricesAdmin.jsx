import { useCallback, useEffect, useMemo, useState } from "react";
import { AIcon, PageHead, api, toast, usd } from "./ui";

function fmtTime(at) {
  if (!at) return "—";
  try {
    return new Date(at).toLocaleString("km-KH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(at);
  }
}

function Delta({ type, delta, pct }) {
  if (type === "new") return <span className="ad-px-tag new">ថ្មី</span>;
  if (type === "removed") return <span className="ad-px-tag gone">លុប</span>;
  const up = type === "up";
  return (
    <span className={`ad-px-delta${up ? " up" : " down"}`}>
      <span className="ad-px-arrow">{up ? "▲" : "▼"}</span>
      <span>
        {up ? "+" : ""}
        {usd(delta)}
        {pct != null ? ` (${up ? "+" : ""}${pct}%)` : ""}
      </span>
    </span>
  );
}

export default function PricesAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all"); // all | up | down | new
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const d = await api("/api/admin/kt-prices");
      setData(d);
    } catch (e) {
      setErr(
        String(e.message || "").includes("not set")
          ? "មិនទាន់កំណត់ KHMER_TOPUP_API_KEY"
          : e.message || "ទាញតម្លៃមិនបាន",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function snapshot() {
    setBusy(true);
    try {
      const d = await api("/api/admin/kt-prices/snapshot", { method: "POST", body: "{}" });
      setData((prev) => ({
        ...(prev || {}),
        ...d,
        changes: d.changes || [],
        currentAt: d.snapshot?.at || prev?.currentAt,
        previousAt: d.previousAt,
      }));
      // refresh full compare live vs new baseline
      await load();
      toast(d.skipped ? "Snapshot ស្រដៀងគ្នា — រក្សាទុកមុន" : "បានរក្សា snapshot តម្លៃ");
    } catch (e) {
      toast(e.message || "Snapshot មិនបាន", "bad");
    } finally {
      setBusy(false);
    }
  }

  const changes = data?.changes || [];
  const stats = useMemo(() => {
    let up = 0,
      down = 0,
      neu = 0,
      gone = 0;
    for (const c of changes) {
      if (c.type === "up") up++;
      else if (c.type === "down") down++;
      else if (c.type === "new") neu++;
      else if (c.type === "removed") gone++;
    }
    return { up, down, neu, gone, total: changes.length };
  }, [changes]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return changes.filter((c) => {
      if (filter === "up" && c.type !== "up") return false;
      if (filter === "down" && c.type !== "down") return false;
      if (filter === "new" && c.type !== "new" && c.type !== "removed") return false;
      if (!s) return true;
      return (
        String(c.packName).toLowerCase().includes(s) ||
        String(c.gameName).toLowerCase().includes(s) ||
        String(c.packId).toLowerCase().includes(s)
      );
    });
  }, [changes, filter, q]);

  return (
    <div className="ad-page-prices">
      <PageHead km="តាមដានតម្លៃ" en="Khmer TopUp cost watch — up / down">
        <div className="ad-row-btns">
          <button type="button" className="ad-btn soft" onClick={load} disabled={loading}>
            <AIcon name="refresh" size={15} /> ផ្ទុកឡើងវិញ
          </button>
          <button type="button" className="ad-btn primary" onClick={snapshot} disabled={busy || loading}>
            {busy ? "…" : "រក្សា Snapshot"}
          </button>
        </div>
      </PageHead>

      <p className="ad-px-lead">
        ប្រៀបធៀប <b>តម្លៃដើម (cost)</b> ពី Khmer TopUp នឹង snapshot មុន — ឃើញថ្លៃឡើង / ធ្លាក់ មុនកែ markup
      </p>

      {err ? <p className="ad-error">{err}</p> : null}

      <div className="ad-px-stats">
        <div className="ad-px-stat">
          <span className="ad-px-stat-l">ផ្លាស់ប្តូរ</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="ad-px-stat up">
          <span className="ad-px-stat-l">ឡើងថ្លៃ</span>
          <strong>{stats.up}</strong>
        </div>
        <div className="ad-px-stat down">
          <span className="ad-px-stat-l">ធ្លាក់ថ្លៃ</span>
          <strong>{stats.down}</strong>
        </div>
        <div className="ad-px-stat">
          <span className="ad-px-stat-l">ថ្មី / លុប</span>
          <strong>
            {stats.neu}/{stats.gone}
          </strong>
        </div>
      </div>

      <div className="ad-px-meta">
        <span>
          Snapshot មុន: <b>{fmtTime(data?.previousAt)}</b>
        </span>
        <span>
          Live ឥឡូវ: <b>{fmtTime(data?.currentAt)}</b>
        </span>
        <span>
          Packs: <b>{data?.liveCount ?? "—"}</b>
        </span>
      </div>

      <section className="ad-card ad-toolbar">
        <div className="ad-search grow">
          <AIcon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ស្វែងរកហ្គេម / កញ្ចប់…" />
        </div>
        <div className="ad-chips">
          {[
            ["all", "ទាំងអស់"],
            ["up", "ឡើង"],
            ["down", "ធ្លាក់"],
            ["new", "ថ្មី/លុប"],
          ].map(([k, label]) => (
            <button key={k} type="button" className={`ad-chip${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="ad-loading">
          <span className="ad-spin" /> កំពុងទាញតម្លៃពី Khmer TopUp…
        </div>
      ) : list.length === 0 ? (
        <div className="ad-px-empty">
          <strong>គ្មានការផ្លាស់ប្តូរតម្លៃ</strong>
          <p>
            {data?.message === "snapshot_first"
              ? "បានបង្កើត snapshot ដំបូង — ពិនិត្យម្តងទៀតពេលក្រោយ"
              : "តម្លៃដើមស្មើ snapshot មុន · ចុច «រក្សា Snapshot» ដើម្បីធ្វើចំណុចគោលថ្មី"}
          </p>
        </div>
      ) : (
        <div className="ad-px-table-wrap">
          <table className="ad-px-table">
            <thead>
              <tr>
                <th>ហ្គេម</th>
                <th>កញ្ចប់</th>
                <th className="r">មុន</th>
                <th className="r">ឥឡូវ</th>
                <th className="r">ផ្លាស់ប្តូរ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.packId} className={`ad-px-row ${c.type}`}>
                  <td>
                    <div className="ad-px-game">{c.gameName}</div>
                    <code>{c.gameSlug}</code>
                  </td>
                  <td>
                    <div className="ad-px-pack">{c.packName}</div>
                    <code>{c.packId}</code>
                  </td>
                  <td className="r muted">{c.from != null ? usd(c.from) : "—"}</td>
                  <td className="r">{c.to != null ? usd(c.to) : "—"}</td>
                  <td className="r">
                    <Delta type={c.type} delta={c.delta} pct={c.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.snapshots?.length ? (
        <section className="ad-px-history">
          <h3>Snapshot ថ្មីៗ</h3>
          <ul>
            {[...data.snapshots].reverse().map((s) => (
              <li key={s.at}>
                <time>{fmtTime(s.at)}</time>
                <span>{s.count} packs</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
