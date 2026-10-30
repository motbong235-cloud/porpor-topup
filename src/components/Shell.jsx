import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "./Icons";
import { LiveChat } from "./LiveChat";
import { refreshCatalog } from "../lib/catalog";

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
  const [tgUser, setTgUser] = useState(null);
  const [tgBot, setTgBot] = useState("");
  const [tgOpen, setTgOpen] = useState(false);
  const [tgErr, setTgErr] = useState("");
  const pwa = useInstallPrompt();
  const lift = location.pathname.startsWith("/game");

  function loadTgConfig() {
    return fetch("/api/auth/telegram/config", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const u = (d?.botUsername || "").replace(/^@/, "").trim();
        setTgBot(u);
        return u;
      })
      .catch(() => {
        setTgBot("");
        return "";
      });
  }
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d.user) setTgUser(d.user); })
      .catch(() => {});
    loadTgConfig();
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("tg_login") === "ok") {
        u.searchParams.delete("tg_login");
        window.history.replaceState({}, "", u.pathname + u.search);
        fetch("/api/auth/me", { credentials: "include" })
          .then((r) => r.json())
          .then((d) => { if (d?.ok && d.user) setTgUser(d.user); })
          .catch(() => {});
      }
      if (u.searchParams.get("tg_login") === "fail") {
        setTgErr(lang === "km" ? "Login បរាជ័យ — សាកម្តងទៀត" : "Login failed");
        u.searchParams.delete("tg_login");
        window.history.replaceState({}, "", u.pathname + u.search);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    window.onTelegramAuth = (user) => {
      setTgErr("");
      fetch("/api/auth/telegram", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok || !d?.ok) {
            setTgErr(d?.error || "login_failed");
            return;
          }
          setTgUser(d.user);
          setTgOpen(false);
          refreshCatalog().catch(() => {});
        })
        .catch(() => setTgErr("network"));
    };
    return () => { delete window.onTelegramAuth; };
  }, []);
  useEffect(() => {
    if (!tgOpen) return;
    let cancelled = false;
    setTgErr("");
    (async () => {
      let bot = tgBot;
      if (!bot) bot = await loadTgConfig();
      if (cancelled || !bot) return;
      await new Promise((r) => requestAnimationFrame(r));
      const box = document.getElementById("tg-login-widget");
      if (!box || cancelled) return;
      box.innerHTML = "";
      const origin = window.location.origin;
      const host = window.location.hostname;
      const authUrl = `${origin}/api/auth/telegram/callback`;

      // 1) Direct iframe — always visible if domain is valid
      const iframe = document.createElement("iframe");
      iframe.src = `https://oauth.telegram.org/embed/${encodeURIComponent(bot)}?origin=${encodeURIComponent(origin)}&size=large&request_access=write&return_to=${encodeURIComponent(authUrl)}`;
      iframe.width = "100%";
      iframe.height = "48";
      iframe.frameBorder = "0";
      iframe.scrolling = "no";
      iframe.setAttribute("title", "Telegram Login");
      iframe.style.cssText = "border:0;overflow:hidden;width:100%;height:48px;display:block;";
      box.appendChild(iframe);

      // 2) Official widget script (onauth + auth-url fallback)
      const sc = document.createElement("script");
      sc.src = "https://telegram.org/js/telegram-widget.js?22";
      sc.async = true;
      sc.setAttribute("data-telegram-login", bot);
      sc.setAttribute("data-size", "large");
      sc.setAttribute("data-radius", "12");
      sc.setAttribute("data-auth-url", authUrl);
      sc.setAttribute("data-request-access", "write");
      box.appendChild(sc);

      setTimeout(() => {
        if (cancelled) return;
        // if embed returned "Bot domain invalid" the iframe body is tiny / empty of button
        // still show domain hint
        const hasBtn = box.querySelector("iframe");
        if (!hasBtn) {
          setTgErr(lang === "km"
            ? `BotFather → /setdomain → ${host}`
            : `BotFather → /setdomain → ${host}`);
        }
      }, 3000);
    })();
    return () => { cancelled = true; };
  }, [tgOpen, tgBot, lang]);
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
      <header className="header site-header">
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
            {tgUser ? (
              <button
                type="button"
                className="header-user-btn is-on"
                title={tgUser.username || tgUser.first_name}
                onClick={() =>
                  fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => setTgUser(null))
                }
              >
                {tgUser.photo_url ? (
                  <img src={tgUser.photo_url} alt="" className="header-user-photo" />
                ) : (
                  <span className="header-user-initial">
                    {(tgUser.first_name || tgUser.username || "U")[0].toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="header-user-btn"
                aria-label={lang === "km" ? "Login Telegram" : "Telegram Login"}
                title={lang === "km" ? "Login Telegram" : "Telegram Login"}
                onClick={() => setTgOpen(true)}
              >
                <Icon name="user" size={18} />
              </button>
            )}
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

            <section className="trust-strip" aria-label="Why us">
        <div className="trust-card">
          <span className="trust-ico"><Icon name="zap" size={20} /></span>
          <div>
            <strong>{lang === "km" ? "លឿនភ្លាមៗ" : "Lightning Fast"}</strong>
            <p>{lang === "km" ? "Order ដំណើរការក្នុងរយៈពេលវិនាទី" : "Orders processed in seconds, not minutes."}</p>
          </div>
        </div>
        <div className="trust-card">
          <span className="trust-ico"><Icon name="clock" size={20} /></span>
          <div>
            <strong>{lang === "km" ? "ដឹកជញ្ជូនភ្លាម" : "Instant Delivery"}</strong>
            <p>{lang === "km" ? "Top-up ចូលគណនីស្វ័យប្រវត្តិ / Live Chat" : "Top-ups land in your account automatically."}</p>
          </div>
        </div>
        <div className="trust-card">
          <span className="trust-ico"><Icon name="shield" size={20} /></span>
          <div>
            <strong>{lang === "km" ? "សុវត្ថិភាព" : "Safe & Secure"}</strong>
            <p>{lang === "km" ? "ការបង់ប្រាក់ការពារពេញលេញ" : "Every payment protected end-to-end."}</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <LogoMark url={settings && settings.logoUrl} />
              <div>
                <div className="footer-name">POR POR <span className="text-brand">TOPUP</span></div>
                <div className="footer-tag">{t(lang, "tagline")}</div>
              </div>
            </div>
            <p className="footer-desc">{lang === "km" ? "លឿន · សុវត្ថិភាព · ទុកចិត្តបាន" : "Fast · Safe · Trusted"}</p>
          </div>
          <div className="footer-col">
            <div className="footer-label">{lang === "km" ? "តំណភ្ជាប់" : "Quick Links"}</div>
            <div className="footer-links-col">
              <Link to="/">{t(lang, "home")}</Link>
              <Link to="/track">{t(lang, "track")}</Link>
              <Link to="/orders">{t(lang, "orders")}</Link>
              <Link to="/reseller">{t(lang, "reseller")}</Link>
            </div>
          </div>
          <div className="footer-col">
            <div className="footer-label">{lang === "km" ? "ផ្លូវការ" : "Legal"}</div>
            <div className="footer-links-col">
              <Link to="/legal/privacy">{t(lang, "privacy")}</Link>
              <Link to="/legal/terms">{t(lang, "terms")}</Link>
              <Link to="/legal/cookies">{t(lang, "cookies")}</Link>
            </div>
          </div>
          <div className="footer-col">
            <div className="footer-label">{t(lang, "accept")}</div>
            <div className="pay-logos">
              <img className="pay-logo aba" src="/aba-logo.svg" alt="ABA" height={28} />
              <img className="pay-logo khqr" src="/khqr-logo.svg" alt="KHQR" height={28} />
            </div>
          </div>
        </div>
        <div className="footer-copy">
          © {new Date().getFullYear()} POR POR TOPUP · {t(lang, "rights")}
        </div>
      </footer>

      {tgOpen ? (
        <div className="tg-login-overlay" onClick={() => setTgOpen(false)} role="presentation">
          <div className="tg-login-modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Telegram login">
            <button type="button" className="tg-login-close" onClick={() => setTgOpen(false)} aria-label="Close">×</button>
            <h3>{lang === "km" ? "ចូលតាម Telegram" : "Login with Telegram"}</h3>
            <div id="tg-login-widget" className="tg-login-widget" />
            {!tgBot ? (
              <p className="tg-login-err">{lang === "km" ? "មិនទាន់កំណត់ Bot" : "Bot not configured"}</p>
            ) : null}
            {tgErr ? <p className="tg-login-err" style={{ marginTop: 12 }}>{tgErr}</p> : null}
          </div>
        </div>
      ) : null}
      <LiveChat lang={lang} logoUrl={settings && settings.logoUrl} />

      <div className={`overlay${menu ? " open" : ""}`} onClick={() => setMenu(false)} />
      <aside className={`drawer${menu ? " open" : ""}`} aria-hidden={!menu}>
        <div className="drawer-head">
          <LogoMark url={settings && settings.logoUrl} style={{ width: 42, height: 42, fontSize: 13 }} />
          <div className="drawer-brand">
            <div className="drawer-brand-name">
              POR POR <span className="text-brand">TOPUP</span>
            </div>
            <div className="drawer-brand-tag">{t(lang, "tagline")}</div>
          </div>
          <button type="button" className="icon-btn drawer-close" aria-label={t(lang, "close")} onClick={() => setMenu(false)}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="drawer-nav">
          <Link to="/" className="drawer-link" onClick={() => setMenu(false)}>
            <Icon name="home" size={18} /> <span>{t(lang, "home")}</span>
          </Link>
          <Link to="/track" className="drawer-link" onClick={() => setMenu(false)}>
            <Icon name="search" size={18} /> <span>{t(lang, "track")}</span>
          </Link>
          <Link to="/orders" className="drawer-link" onClick={() => setMenu(false)}>
            <Icon name="orders" size={18} /> <span>{t(lang, "orders")}</span>
          </Link>
          <Link to="/support" className="drawer-link" onClick={() => setMenu(false)}>
            <Icon name="help" size={18} /> <span>{t(lang, "help")}</span>
          </Link>
          <Link to="/reseller" className="drawer-link" onClick={() => setMenu(false)}>
            <Icon name="store" size={18} /> <span>{t(lang, "reseller")}</span>
          </Link>
          {pwa.visible ? (
            <button type="button" className="drawer-link nav-item install-item" onClick={handleInstall}>
              <Icon name="download" size={18} /> <span>{t(lang, "install")}</span>
            </button>
          ) : null}
          <div className="drawer-section">{lang === "km" ? "ផ្លូវការ" : "LEGAL"}</div>
          <Link to="/legal/privacy" className="drawer-link soft" onClick={() => setMenu(false)}>
            <Icon name="shield" size={18} /> <span>{t(lang, "privacy")}</span>
          </Link>
          <Link to="/legal/terms" className="drawer-link soft" onClick={() => setMenu(false)}>
            <Icon name="orders" size={18} /> <span>{t(lang, "terms")}</span>
          </Link>
          <Link to="/legal/cookies" className="drawer-link soft" onClick={() => setMenu(false)}>
            <Icon name="help" size={18} /> <span>{t(lang, "cookies")}</span>
          </Link>
        </nav>
        <div className="drawer-foot">
          {tgUser ? (
            <button
              type="button"
              className="drawer-login-btn"
              onClick={() =>
                fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                  setTgUser(null);
                  setMenu(false);
                })
              }
            >
              <Icon name="user" size={16} />
              {lang === "km" ? "ចាកចេញ" : "Log out"}
              {tgUser.username ? ` · @${tgUser.username}` : ""}
            </button>
          ) : (
            <button
              type="button"
              className="drawer-login-btn"
              onClick={() => {
                setMenu(false);
                setTgOpen(true);
              }}
            >
              <Icon name="user" size={16} />
              {lang === "km" ? "Login / Register" : "Login / Register"}
            </button>
          )}
        </div>
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
            {t(lang, "installShort")}
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
