import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { money } from "../lib/store";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "../components/Icons";

function GameCard({ game, lang, famous }) {
  const badge = !game.open ? (
    <span className="game-badge off">{t(lang, "off")}</span>
  ) : famous ? (
    <span className="game-badge hot">{t(lang, "hot")}</span>
  ) : null;

  const cta = game.open ? (
    <span className="game-cta on">{t(lang, "topup")}</span>
  ) : (
    <span className="game-cta off">{t(lang, "off")}</span>
  );

  if (!game.open) {
    return (
      <div className="game-card disabled" title={t(lang, "unavailable")}>
        {badge}
        <GameTile game={game} />
        <div className="game-name">{game.name}</div>
        {cta}
      </div>
    );
  }

  return (
    <Link className="game-card" to={`/game/${game.id}`}>
      {badge}
      <GameTile game={game} />
      <div className="game-name">{game.name}</div>
      {cta}
    </Link>
  );
}

export default function Home({ lang }) {
  const { games, loading, error } = useCatalog();
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState("");
  const famous = useMemo(() => games.filter((g) => g.famous), [games]);
  const spotlight = useMemo(() => (famous.length ? famous : games).slice(0, 3), [famous, games]);
  const firstTo = games[0] ? `/game/${games[0].id}` : "/";
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.mark.toLowerCase().includes(q) ||
        g.nameKm.toLowerCase().includes(q),
    );
  }, [games, filter]);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % 3), 5600);
    return () => clearInterval(id);
  }, []);

  const slides = [
    { tone: "banner-deep", kicker: "kicker1", title: "title1", sub: "sub1", to: firstTo, badge: "PP", ghost: true },
    { tone: "banner-ice", kicker: "kicker2", title: "title2", sub: "sub2", to: firstTo, badge: games[0]?.mark || "TOP", ghost: false },
    { tone: "banner-night", kicker: "kicker3", title: "title3", sub: "sub3", to: "/support", badge: "QR", ghost: false },
  ];

  return (
    <div className="container">
      <section className="banner">
        {slides.map((s, i) => (
          <div key={s.kicker} className={`banner-slide ${s.tone}${i === slide ? " active" : ""}`}>
            <div className="banner-copy">
              <div className="kicker">
                <span className="kicker-dot" />
                {t(lang, s.kicker)}
              </div>
              <h1 className="banner-title">{t(lang, s.title)}</h1>
              <p className="banner-sub">{t(lang, s.sub)}</p>
              <div className="banner-actions">
                <Link className="btn bg-brand" to={s.to}>
                  {s.ghost ? t(lang, "shopNow") : s.to === "/support" ? t(lang, "help") : t(lang, "shopNow")}
                </Link>
                {s.ghost && (
                  <a className="btn btn-ghost" href="#games">
                    {t(lang, "seeGames")}
                  </a>
                )}
              </div>
            </div>
            <div className="banner-badge">{s.badge}</div>
          </div>
        ))}
        <button type="button" className="banner-nav prev" aria-label="prev" onClick={() => setSlide((s) => (s + 2) % 3)}>
          <Icon name="chevL" size={18} />
        </button>
        <button type="button" className="banner-nav next" aria-label="next" onClick={() => setSlide((s) => (s + 1) % 3)}>
          <Icon name="chevR" size={18} />
        </button>
        <div className="banner-dots">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" className={`dot${i === slide ? " active" : ""}`} onClick={() => setSlide(i)} />
          ))}
        </div>
      </section>

      {spotlight.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="star">
              <Icon name="star" size={16} />
            </span>
            <h2>{t(lang, "special")}</h2>
          </div>
          <div className="events">
            {spotlight.map((g) => {
              const min = Math.min(...g.packs.map((p) => p.price));
              return (
                <Link key={g.id} className="event-card" to={`/game/${g.id}`}>
                  <div className="event-art game-tile" style={{ "--h": g.hue }}>
                    <span className="event-tag">{t(lang, "hot")}</span>
                    <div className="event-meta">
                      <strong>{g.name}</strong>
                      <span>{lang === "km" ? `ចាប់ពី ${money(min)}` : `From ${money(min)}`}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {famous.length > 0 && (
      <section className="section">
        <div className="section-head">
          <span className="star">
            <Icon name="star" size={16} />
          </span>
          <h2>{t(lang, "famous")}</h2>
        </div>
        <p className="section-sub">{t(lang, "famousSub")}</p>
        <div className="game-grid">
          {famous.map((g) => (
            <GameCard key={g.id} game={g} lang={lang} famous />
          ))}
        </div>
      </section>
      )}

      <section className="section" id="games">
        <div className="toolbar">
          <div className="section-head" style={{ margin: 0 }}>
            <span className="star">
              <Icon name="star" size={16} />
            </span>
            <h2>{t(lang, "all")}</h2>
          </div>
          <input
            className="search-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t(lang, "searchPh")}
            aria-label={t(lang, "filter")}
          />
        </div>
        <p className="count">
          {filtered.length} {t(lang, "countGames")}
        </p>
        <div className="game-grid">
          {loading ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "catalogLoading")}
            </div>
          ) : error ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "catalogError")}
            </div>
          ) : games.length === 0 ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "catalogEmpty")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "searchEmpty")}
            </div>
          ) : (
            filtered.map((g) => <GameCard key={g.id} game={g} lang={lang} famous={g.hot} />)
          )}
        </div>
      </section>

      <section className="promise">
        <div className="promise-pill">
          <span className="kicker-dot" style={{ background: "var(--primary)" }} />
          {t(lang, "promise")}
        </div>
        <h2>
          {t(lang, "promiseA")}
          <span className="text-brand">{t(lang, "promiseB")}</span>
        </h2>
        <p>{t(lang, "promiseBody")}</p>
        <div className="stats">
          <div className="stat">
            <div className="stat-icon">
              <Icon name="package" size={22} />
            </div>
            <div className="stat-value">10,000,000+</div>
            <div className="stat-label">{t(lang, "statOrders")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="game" size={22} />
            </div>
            <div className="stat-value">{games.length}+</div>
            <div className="stat-label">{t(lang, "statGames")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="zap" size={22} />
            </div>
            <div className="stat-value">1 sec – 5 min</div>
            <div className="stat-label">{t(lang, "statSpeed")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="help" size={22} />
            </div>
            <div className="stat-value">24 / 7</div>
            <div className="stat-label">{t(lang, "statChat")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
