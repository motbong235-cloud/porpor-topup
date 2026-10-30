import { Link, useParams } from "react-router-dom";
import { t } from "../lib/i18n";

export default function Legal({ lang }) {
  const { slug } = useParams();
  const active = slug === "terms" ? "terms" : slug === "cookies" ? "cookies" : "privacy";
  const key = active === "terms" ? "legalTerms" : active === "cookies" ? "legalCookies" : "legalPrivacy";
  const lines = t(lang, key);

  return (
    <div className="container">
      <div className="legal-tabs">
        <Link to="/legal/privacy" className={active === "privacy" ? "active" : ""} style={{ textDecoration: "none" }}>
          <span className={active === "privacy" ? "btn bg-brand" : "btn-soft"} style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
            {t(lang, "privacy")}
          </span>
        </Link>
        <Link to="/legal/terms" style={{ textDecoration: "none" }}>
          <span className={active === "terms" ? "btn bg-brand" : "btn-soft"} style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
            {t(lang, "terms")}
          </span>
        </Link>
        <Link to="/legal/cookies" style={{ textDecoration: "none" }}>
          <span className={active === "cookies" ? "btn bg-brand" : "btn-soft"} style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
            {t(lang, "cookies")}
          </span>
        </Link>
      </div>
      <h1 className="page-title">{t(lang, active)}</h1>
      <div className="legal-body">
        {(Array.isArray(lines) ? lines : []).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
