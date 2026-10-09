import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t } from "../lib/i18n";
import { money } from "../lib/store";

export default function Track({ lang, orders }) {
  const [params, setParams] = useSearchParams();
  const initial = params.get("code") || "";
  const [q, setQ] = useState(initial);
  const [query, setQuery] = useState(initial);

  const hits = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return [];
    return orders.filter(
      (o) =>
        o.id.toLowerCase() === s ||
        o.id.toLowerCase().includes(s) ||
        String(o.userId).toLowerCase() === s,
    );
  }, [orders, query]);

  return (
    <div className="container">
      <h1 className="page-title">{t(lang, "track")}</h1>
      <form
        className="track-form"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
          setParams(q.trim() ? { code: q.trim() } : {});
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "trackPh")} />
        <button type="submit" className="bg-brand btn">
          {t(lang, "lookup")}
        </button>
      </form>

      {!query.trim() ? null : hits.length === 0 ? (
        <p className="empty">{t(lang, "noOrder")}</p>
      ) : (
        hits.map((o) => (
          <div key={o.id} className="detail">
            <div className="code-row">
              <div className="code">{o.id}</div>
              <button
                type="button"
                className="btn-soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(o.id);
                  } catch {}
                }}
              >
                {t(lang, "copy")}
              </button>
            </div>
            <div className="badge-ok">{t(lang, "delivered")}</div>
            <dl>
              <div className="row">
                <dt>{t(lang, "items")}</dt>
                <dd>
                  {o.gameName} · {o.packName} × {o.qty}
                </dd>
              </div>
              <div className="row">
                <dt>{t(lang, "nickname")}</dt>
                <dd>{o.nickname}</dd>
              </div>
              <div className="row">
                <dt>{t(lang, "playerId")}</dt>
                <dd>{o.zoneId ? `${o.userId} (${o.zoneId})` : o.userId}</dd>
              </div>
              {o.server ? (
                <div className="row">
                  <dt>{t(lang, "server")}</dt>
                  <dd>{o.server}</dd>
                </div>
              ) : null}
              <div className="row">
                <dt>{t(lang, "method")}</dt>
                <dd>{o.method === "khqr" ? "ABA KHQR" : t(lang, "wallet")}</dd>
              </div>
              <div className="row">
                <dt>{t(lang, "discount")}</dt>
                <dd>{money(o.discount)}</dd>
              </div>
              <div className="row">
                <dt>{t(lang, "total")}</dt>
                <dd>{money(o.total)}</dd>
              </div>
              <div className="row">
                <dt>{t(lang, "when")}</dt>
                <dd>{new Date(o.createdAt).toLocaleString(lang === "km" ? "km-KH" : "en-GB")}</dd>
              </div>
            </dl>
          </div>
        ))
      )}
    </div>
  );
}
