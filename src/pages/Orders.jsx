import { Link } from "react-router-dom";
import { t } from "../lib/i18n";
import { money } from "../lib/store";

export default function Orders({ lang, orders }) {
  if (!orders.length) {
    return (
      <div className="container">
        <h1 className="page-title">{t(lang, "orders")}</h1>
        <div className="empty">
          {t(lang, "noOrders")}
          <br />
          <Link className="btn bg-brand" style={{ marginTop: 20 }} to="/">
            {t(lang, "seeGames")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">{t(lang, "orders")}</h1>
      <div className="list">
        {orders.map((o) => (
          <Link key={o.id} className="list-item" to={`/track?code=${encodeURIComponent(o.id)}`}>
            <div className="top">
              <div>
                <div className="title">{o.gameName}</div>
                <div className="sub">
                  {o.packName} × {o.qty}
                </div>
                <div className="code">{o.id}</div>
              </div>
              <div>
                <div className="price">{money(o.total)}</div>
                <div className="status">{t(lang, `st_${o.status || "pending"}`)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
