import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "./Icons";

function LogoMark({ url, style }) {
  const [broken, setBroken] = useState("");
  if (url && broken !== url) {
    return (
      <div className="logo-mark has-img" style={style}>
        <img src={url} alt="logo" onError={() => setBroken(url)} />
      </div>
    );
  }
  return (
    <div className="logo-mark" style={style}>
      PP
    </div>
  );
}

export function Shell({ lang, theme, setLang, setTheme, children, settings }) {
  const { games } = useCatalog();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [iosHelp, setIosHelp] = useState(false);
  const pwa = useInstallPrompt();
  const lift = location.pathname.startsWith("/game");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = lang === "km" ? "km" : "en";
  }, [theme, lang]);

  useEffect(() => {
    document.body.style.overflow = menu || search ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu, search]);

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [location.pathname, location.search]);

  const [bannerGone, setBannerGone] = useState(() => {
    try {
      return localStorage.getItem("pp_install_banner_gone") === "1";
    } catch {
      return false;
    }
  });

  async function handleInstall() {
    setMenu(false);
    if (pwa.canPrompt) {
      const r = await pwa.install();
      if (r === "unavailable" || r === "dismissed") setIosHelp(true);
    } else {
      setIosHelp(true);
    }
  }

  function dismissBanner() {
    setBannerGone(true);
    try {
      localStorage.setItem("pp_install_banner_gone", "1");
    } catch {}
  }

  const showBanner =
    pwa.visible && !bannerGone && (location.pathname === "/" || location.pathname === "");

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games
      .filter(
        (g) =>
          g.open &&
          (!s ||
            g.name.toLowerCase().includes(s) ||
            g.mark.toLowerCase().includes(s) ||
            g.nameKm.toLowerCase().includes(s)),
      )
      .slice(0, 10);
  }, [games, q]);

  return (
    <div className="shell">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <LogoMark url={settings && settings.logoUrl} />
            <div className="logo-text">
              <div className="logo-name">
                <span>POR POR</span> <span className="text-brand">TOPUP</span>
              </div>
              <div className="logo-tag">{t(lang, "tagline")}</div>
            </div>
          </Link>
          <div className="header-actions">
            <button type="button" className="lang-btn" onClick={() => setLang(lang === "km" ? "en" : "km")}>
              {lang === "km" ? "EN" : "ខ្មែរ"}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={theme === "dark" ? t(lang, "light") : t(lang, "dark")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
            <button type="button" className="icon-btn ghost" aria-label={t(lang, "search")} onClick={() => setSearch(true)}>
              <Icon name="search" />
            </button>
            <button type="button" className="icon-btn ghost" aria-label={t(lang, "menu")} onClick={() => setMenu(true)}>
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">
              POR POR <span className="text-brand">TOPUP</span>
            </div>
            <div className="footer-tag">{t(lang, "tagline")}</div>
            <p className="footer-desc">{t(lang, "trusted")}</p>
            <p className="footer-years">{t(lang, "years")}</p>
          </div>
          <div>
            <div className="footer-label">{t(lang, "accept")}</div>
            <div className="pay-logos">
              <img className="pay-logo aba" src="/aba-logo.svg" alt="ABA" height={28} />
              <img className="pay-logo khqr" src="/khqr-logo.svg" alt="KHQR" height={28} />
              <img className="pay-logo aba-khqr" src="/aba-khqr.svg" alt="ABA KHQR" height={32} />
            </div>
            <div className="footer-links">
              <Link to="/legal/privacy">{t(lang, "privacy")}</Link>
              <Link to="/legal/terms">{t(lang, "terms")}</Link>
              <Link to="/legal/cookies">{t(lang, "cookies")}</Link>
            </div>
          </div>
        </div>
        <div className="footer-copy">
          © {new Date().getFullYear()} POR POR TOPUP · {t(lang, "rights")}
        </div>
      </footer>

      <a
        className={`float-chat bg-brand${lift ? " lift" : ""}${showBanner ? " above-install" : ""}`}
        href={(settings && settings.telegram) || "https://t.me/porportopup"}
        target="_blank"
        rel="noreferrer"
        aria-label={t(lang, "chat")}
      >
        <Icon name="help" />
      </a>

      <div className={`overlay${menu ? " open" : ""}`} onClick={() => setMenu(false)} />
      <aside className={`drawer${menu ? " open" : ""}`}>
        <div className="drawer-head">
          <LogoMark url={settings && settings.logoUrl} style={{ width: 44, height: 44, fontSize: 13 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>
              POR POR <span className="text-brand">TOPUP</span>
            </div>
            <div className="logo-tag" style={{ marginTop: 2 }}>
              {t(lang, "tagline")}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label={t(lang, "close")} onClick={() => setMenu(false)}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="drawer-nav">
          <Link to="/" onClick={() => setMenu(false)}>
            <Icon name="home" /> {t(lang, "home")}
          </Link>
          <Link to="/orders" onClick={() => setMenu(false)}>
            <Icon name="orders" /> {t(lang, "orders")}
          </Link>
          <Link to="/track" onClick={() => setMenu(false)}>
            <Icon name="search" /> {t(lang, "track")}
          </Link>
          <Link to="/support" onClick={() => setMenu(false)}>
            <Icon name="help" /> {t(lang, "help")}
          </Link>
          <Link to="/reseller" onClick={() => setMenu(false)}>
            <Icon name="store" /> {t(lang, "reseller")}
          </Link>
          {pwa.visible && (
            <button type="button" className="nav-item install-item" onClick={handleInstall}>
              <Icon name="download" /> {t(lang, "install")}
            </button>
          )}
        </nav>
      </aside>

      <div className={`search-modal${search ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setSearch(false)}>
        <div className="search-panel">
          <div className="search-bar">
            <Icon name="search" />
            <input
              autoFocus={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(lang, "searchPh")}
            />
            <button type="button" className="icon-btn ghost" aria-label={t(lang, "close")} onClick={() => setSearch(false)}>
              <Icon name="x" />
            </button>
          </div>
          <ul className="search-hits">
            {hits.length === 0 ? (
              <li className="empty">{t(lang, "searchEmpty")}</li>
            ) : (
              hits.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(false);
                      setQ("");
                      navigate(`/game/${g.id}`);
                    }}
                  >
                    <GameTile game={g} className="hit-tile" />
                    <span className="hit-meta">
                      <strong>{g.name}</strong>
                      <span>{g.region}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {showBanner && (
        <div className="install-banner" role="region" aria-label={t(lang, "install")}>
          <div className="install-banner-logo" aria-hidden>
            <LogoMark url={settings && settings.logoUrl} style={{ width: 40, height: 40, fontSize: 13 }} />
          </div>
          <div className="install-banner-text">
            <strong>{t(lang, "installTitle")}</strong>
            <span>{t(lang, "installBody")}</span>
          </div>
          <button type="button" className="btn bg-brand install-banner-cta" onClick={handleInstall}>
            {t(lang, "install")}
          </button>
          <button type="button" className="install-banner-x" aria-label={t(lang, "close")} onClick={dismissBanner}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className={`install-modal${iosHelp ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setIosHelp(false)}>
        <div className="install-sheet" role="dialog" aria-modal="true" aria-label={t(lang, "installIosTitle")}>
          <div className="install-sheet-head">
            <LogoMark url={settings && settings.logoUrl} style={{ width: 44, height: 44, fontSize: 13 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{t(lang, "installTitle")}</strong>
              <div className="logo-tag" style={{ marginTop: 2 }}>
                {pwa.isIos ? t(lang, "installIosTitle") : t(lang, "installAndroidTitle")}
              </div>
            </div>
            <button type="button" className="icon-btn" aria-label={t(lang, "close")} onClick={() => setIosHelp(false)}>
              <Icon name="x" />
            </button>
          </div>
          <p className="install-sheet-body">{t(lang, "installBody")}</p>
          <ol className="install-steps">
            {pwa.isIos ? (
              <>
                <li>{t(lang, "installIosStep1")}</li>
                <li>{t(lang, "installIosStep2")}</li>
                <li>{t(lang, "installIosStep3")}</li>
              </>
            ) : (
              <>
                <li>{t(lang, "installAndroidStep1")}</li>
                <li>{t(lang, "installAndroidStep2")}</li>
                <li>{t(lang, "installAndroidStep3")}</li>
              </>
            )}
          </ol>
          {pwa.canPrompt && (
            <button type="button" className="btn bg-brand install-ok" style={{ marginBottom: 10 }} onClick={async () => { await pwa.install(); setIosHelp(false); }}>
              {t(lang, "install")}
            </button>
          )}
          <button type="button" className="btn bg-brand install-ok" onClick={() => setIosHelp(false)}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
