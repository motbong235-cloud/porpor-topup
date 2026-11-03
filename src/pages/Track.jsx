import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { useSearchParams } from "react-router-dom";
import { t } from "../lib/i18n";
import { money } from "../lib/store";

export default function Track({ lang, settings }) {
  const [params, setParams] = useSearchParams();
  const initial = params.get("code") || "";
  const [q, setQ] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [hits, setHits] = useState([]);

  const telegram = settings?.telegram || "https://t.me/porportopup";

  useEffect(() => {
    const code = query.trim();
    if (!code) {
      setHits([]);
      return undefined;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/orders/track?q=${encodeURIComponent(code)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => alive && setHits(Array.isArray(list) ? list : []))
        .catch(() => {});
    load();
    const timer = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [query]);

  function chatUrl(orderId) {
    const base = String(telegram || "").trim();
    const msg = encodeURIComponent(
      lang === "km"
        ? `សួស្តី បង! បង់ប្រាក់រួចហើយ លេខកម្មង់: ${orderId} សុំជួយដំណើរការផង`
        : `Hi! I have paid. Order: ${orderId}. Please process my order.`,
    );
    if (base.includes("t.me") || base.includes("telegram")) {
      const sep = base.includes("?") ? "&" : "?";
      // t.me/xxx?text= works for some clients; also support t.me/share
      if (base.includes("/share")) return `${base}${sep}url=&text=${msg}`;
      return base.startsWith("http") ? base : `https://t.me/${base.replace("@", "")}`;
    }
    return base || "/support";
  }

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
        hits.map((o) => {
          const isGift = ["gift_code", "stock", "live_chat", "robux_send"].includes(o.deliveryType);
          const isManual = o.deliveryType === "live_chat" || o.deliveryType === "robux_send";
          const openChat = () =>
            window.dispatchEvent(
              new CustomEvent("pp-open-livechat", {
                detail: {
                  orderId: o.id,
                  prefill:
                    lang === "km"
                      ? `សួស្តី Admin! Order ID: ${o.id}\nផលិតផល: ${o.gameName} · ${o.packName} × ${o.qty}`
                      : `Hi Admin! Order ID: ${o.id}\nProduct: ${o.gameName} · ${o.packName} × ${o.qty}`,
                  item: `${o.gameName} · ${o.packName} × ${o.qty}`,
                  amount: o.total,
                  title: "Order",
                },
              }),
            );
          return (
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
                  <Icon name="copy" size={14} /> {t(lang, "copy")}
                </button>
              </div>
              <div className={o.status === "delivered" ? "badge-ok" : "badge-ok pending"}>
                {t(lang, `st_${o.status || "pending"}`)}
              </div>
              <dl>
                <div className="row">
                  <dt>{t(lang, "items")}</dt>
                  <dd>
                    {o.gameName} · {o.packName} × {o.qty}
                  </dd>
                </div>
                {!isGift ? (
                  <>
                    <div className="row">
                      <dt>{t(lang, "nickname")}</dt>
                      <dd>{o.nickname || "—"}</dd>
                    </div>
                    <div className="row">
                      <dt>{t(lang, "playerId")}</dt>
                      <dd>{o.zoneId ? `${o.userId} (${o.zoneId})` : o.userId}</dd>
                    </div>
                  </>
                ) : null}
                <div className="row">
                  <dt>{t(lang, "total")}</dt>
                  <dd>{money(o.total)}</dd>
                </div>
                <div className="row">
                  <dt>{t(lang, "when")}</dt>
                  <dd>{new Date(o.createdAt).toLocaleString(lang === "km" ? "km-KH" : "en-GB")}</dd>
                </div>
              </dl>

              {isGift ? (
                <div className="card" style={{ marginTop: 16, borderColor: "var(--primary)" }}>
                  <h3 style={{ margin: "0 0 8px" }}>{o.gameName}</h3>
                  {o.giftCode ? (
                    <div>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
                        {lang === "km" ? "កូដរបស់អ្នក:" : "Your code:"}
                      </p>
                      <div className="code-row">
                        <div className="code" style={{ fontSize: 18 }}>
                          {o.giftCode}
                        </div>
                        <button
                          type="button"
                          className="btn-soft"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(o.giftCode);
                            } catch {}
                          }}
                        >
                          <Icon name="copy" size={14} /> {t(lang, "copy")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: "0 0 12px" }}>
                        {isManual
                          ? lang === "km"
                            ? "សេវានេះមិន auto ទេ — សូមចូល Live Chat ហើយផ្ញើ Order ID ទៅ Admin ដើម្បីដំណើរការ។"
                            : "This service is not automatic — open Live Chat and send your Order ID to Admin."
                          : lang === "km"
                            ? "បង់រួចហើយ! កូដនឹងបង្ហាញនៅទីនេះស្វ័យប្រវត្តិ។ បើយូរពេក សូមចូល Live Chat។"
                            : "Payment received! Your code will appear here automatically. Open Live Chat if it takes too long."}
                      </p>
                      <button type="button" className="btn bg-brand" onClick={openChat}>
                        {lang === "km" ? "បើក Live Chat" : "Open Live Chat"}
                      </button>
                      <a className="btn-soft" href={chatUrl(o.id)} target="_blank" rel="noreferrer" style={{ marginLeft: 8, textDecoration: "none" }}>
                        Telegram
                      </a>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
