import { useState } from "react";
import { t } from "../lib/i18n";
import { Icon } from "../components/Icons";

export default function Support({ lang, settings }) {
  const [open, setOpen] = useState(1);

  return (
    <div className="container">
      <h1 className="page-title">{t(lang, "help")}</h1>
      <p className="page-lead">{t(lang, "supportLead")}</p>
      <div className="faq">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`faq-item${open === n ? " open" : ""}`}>
            <button type="button" onClick={() => setOpen(open === n ? 0 : n)}>
              {t(lang, `faq${n}q`)}
              <span>
                <Icon name="chevR" size={18} />
              </span>
            </button>
            <div className="body">{t(lang, `faq${n}a`)}</div>
          </div>
        ))}
      </div>
      <a className="btn bg-brand" style={{ marginTop: 24 }} href={(settings && settings.telegram) || "https://t.me/porportopup"} target="_blank" rel="noreferrer">
        {t(lang, "chat")}
      </a>
    </div>
  );
}
