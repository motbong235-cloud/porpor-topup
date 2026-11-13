import { t } from "../lib/i18n";

export default function Reseller({ lang, settings }) {
  const notes =
    lang === "km"
      ? ["ចាប់ពី $50 / ខែ", "ចាប់ពី $300 / ខែ", "ចាប់ពី $1,000 / ខែ"]
      : ["From $50 / month", "From $300 / month", "From $1,000 / month"];
  const rates = ["3%", "6%", "9%"];

  return (
    <div className="container">
      <h1 className="page-title">{t(lang, "reseller")}</h1>
      <p className="page-lead">{t(lang, "resLead")}</p>
      <div className="tiers">
        {[1, 2, 3].map((n) => (
          <article key={n} className="tier">
            <div className="label">{t(lang, `tier${n}`)}</div>
            <div className="rate">{rates[n - 1]}</div>
            <p>{notes[n - 1]}</p>
          </article>
        ))}
      </div>
      <a className="btn bg-brand" style={{ marginTop: 24 }} href={(settings && settings.telegram) || "https://t.me/porportopup"} target="_blank" rel="noreferrer">
        {t(lang, "contact")}
      </a>
    </div>
  );
}
