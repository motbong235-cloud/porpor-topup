import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { money } from "../lib/store";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "../components/Icons";

function fallbackArt(g) {
  const k = `${g?.id || ""} ${g?.name || ""}`.toLowerCase();
  if (/gift|gc|card/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-gift.svg";
  if (/plus|premium/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-plus.svg";
  if (/robux|login/.test(k)) return "/icons/robux.svg";
  if (/roblox|rbx/.test(k)) return "/icons/roblox.svg";
  if (/mlbb|mobile.?legends|\bml\b/.test(k)) return "/icons/mlbb.svg";
  return "/icons/roblox.svg";
}


function minPackPrice(game) {
  const packs = Array.isArray(game?.packs) ? game.packs : [];
  let m = null;
  for (const p of packs) {
    const n = Number(p?.price);
    if (Number.isFinite(n) && n > 0 && (m == null || n < m)) m = n;
  }
  return m;
}

function GameCard({ game, lang, famous }) {
  const badge = !game.open ? (
    <span className="game-badge off">{t(lang, "off")}</span>
  ) : famous ? (
    <span className="game-badge hot">{t(lang, "hot")}</span>
  ) : null;
  const from = minPackPrice(game);

  if (!game.open) {
    return (
      <div className="game-card dino-card disabled" title={t(lang, "unavailable")}>
        {badge}
        <div className="game-card-art">
          <GameTile game={game} />
        </div>
        <div className="game-card-body">
          <div className="game-name">{game.name}</div>
          <span className="game-cta off">{t(lang, "maintenance")}</span>
        </div>
      </div>
    );
  }

  return (
    <Link className="game-card dino-card card-hover" to={`/game/${game.id}`}>
      {badge}
      <div className="game-card-art">
        <GameTile game={game} />
      </div>
      <div className="game-card-body">
        <div className="game-name">{game.name}</div>
        {from != null ? (
          <div className="game-from">
            {lang === "km" ? "តម្លៃពី" : "From"} {money(from)}
          </div>
        ) : null}
        <span className="game-cta on">{t(lang, "topup")}</span>
      </div>
    </Link>
  );
}


const SHOP_HOURS = "8:30 AM – 11:00 PM";

/** Real data from /api/ticker (paid orders, sold count, average delivery time). */
function useTicker() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ticker")
        .then((r) => r.json())
        .then((d) => {
          if (alive && d && d.ok !== false) setData(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return data;
}

function ago(at, lang) {
  if (!at) return "";
  const m = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (lang === "km") {
    if (m < 1) return "ទើបតែ";
    if (m < 60) return `${m} នាទីមុន`;
    if (m < 1440) return `${Math.floor(m / 60)} ម៉ោងមុន`;
    return `${Math.floor(m / 1440)} ថ្ងៃមុន`;
  }
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

function fmtDuration(sec, lang) {
  if (sec == null) return "—";
  if (sec < 60) return lang === "km" ? `${Math.max(1, sec)} វិនាទី` : `${Math.max(1, sec)} sec`;
  const m = Math.round(sec / 60);
  if (m < 60) return lang === "km" ? `${m} នាទី` : `${m} min`;
  const h = Math.round((m / 60) * 10) / 10;
  return lang === "km" ? `${h} ម៉ោង` : `${h} h`;
}

function OrderTicker({ data, lang }) {
  const delivery = (data && data.delivery) || SHOP_HOURS;
  const sold = (data && data.soldLabel) || "ការបញ្ជាទិញ";
  const items = (data && Array.isArray(data.items) ? data.items : []).filter((x) => x && x.label);
  // Need enough chips for a seamless loop; repeat the real items only
  const loop = items.length
    ? items.length < 8
      ? [...items, ...items, ...items, ...items]
      : [...items, ...items]
    : [];
  // slow, calm scroll: ~8s per order (never faster than 45s per loop), whatever the number of orders
  const ordersSpeed = { animationDuration: `${Math.max(45, Math.round((loop.length / 2) * 8))}s` };
  return (
    <div className="pp-ticker" aria-label="orders ticker">
      <div className="pp-ticker-delivery">
        <div className="pp-ticker-track pp-ticker-delivery-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="pp-ticker-chip">
              <span className="pp-ticker-bolt" aria-hidden><Icon name="zap" size={12} /></span>
              {lang === "km" ? "ម៉ោងធ្វើការ" : "Working hours"}: {delivery}
            </span>
          ))}
        </div>
      </div>
      <div className="pp-ticker-sales">
        <div className="pp-ticker-sold">
          <span className="pp-ticker-dot" />
          {sold}
        </div>
        <div className="pp-ticker-scroll">
          {loop.length > 0 ? (
            <div className="pp-ticker-track pp-ticker-orders-track" style={ordersSpeed}>
              {loop.map((it, i) => (
                <span key={(it.id || i) + "-" + i} className="pp-ticker-item">
                  <span className="pp-ticker-ok" aria-hidden><Icon name="check" size={12} /></span>
                  {it.label}
                  {it.at ? <span className="pp-ticker-ago">{ago(it.at, lang)}</span> : null}
                </span>
              ))}
            </div>
          ) : (
            <span className="pp-ticker-item muted">រង់ចាំការបញ្ជាទិញពិត…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GameSkeletons({ n = 8 }) {
  return Array.from({ length: n }).map((_, i) => (
    <div key={i} className="game-card skeleton" aria-hidden>
      <div className="sk-tile" />
      <div className="sk-line" />
      <div className="sk-line short" />
    </div>
  ));
}

export default function Home({ lang, settings }) {
  const { games, loading, error } = useCatalog();
  const ticker = useTicker();
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState("");
  const famous = useMemo(() => games.filter((g) => g.famous), [games]);
  const spotlight = useMemo(() => (famous.length ? famous : games).slice(0, 3), [famous, games]); // top row 3
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

  const custom = (settings && Array.isArray(settings.bannerUrls) ? settings.bannerUrls : []).filter(Boolean);
  const hasCustom = custom.length > 0;
  const count = hasCustom ? custom.length : 3;

  useEffect(() => {
    setSlide(0);
  }, [count]);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % count), 5600);
    return () => clearInterval(id);
  }, [count]);

  const slides = [
    { tone: "banner-deep", kicker: "kicker1", title: "title1", sub: "sub1", to: firstTo, badge: "PP", ghost: true },
    { tone: "banner-ice", kicker: "kicker2", title: "title2", sub: "sub2", to: firstTo, badge: games[0]?.mark || "TOP", ghost: false },
    { tone: "banner-night", kicker: "kicker3", title: "title3", sub: "sub3", to: "/support", badge: "QR", ghost: false },
  ];

  return (
    <div className="container">
      <section className={`banner banner-v2${hasCustom ? " banner-has-photo" : ""}`}>
        {hasCustom
          ? custom.map((url, i) => (
              <div key={url + i} className={`banner-slide banner-photo${i === slide ? " active" : ""}`}>
                <img src={url} alt="" loading={i === 0 ? "eager" : "lazy"} />
              </div>
            ))
          : slides.map((s, i) => (
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
        {count > 1 && (<>
        <button type="button" className="banner-nav prev" aria-label="prev" onClick={() => setSlide((s) => (s + count - 1) % count)}>
          <Icon name="chevL" size={18} />
        </button>
        <button type="button" className="banner-nav next" aria-label="next" onClick={() => setSlide((s) => (s + 1) % count)}>
          <Icon name="chevR" size={18} />
        </button>
        <div className="banner-dots">
          {Array.from({ length: count }, (_, i) => i).map((i) => (
            <button key={i} type="button" className={`dot${i === slide ? " active" : ""}`} onClick={() => setSlide(i)} />
          ))}
        </div>
        </>)}
      </section>

      <OrderTicker data={ticker} lang={lang} />

      {spotlight.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="star">
              <Icon name="star" size={16} />
            </span>
            <h2>{t(lang, "special")}</h2>
          </div>
          <div className="events events-special events-row-3">
            {spotlight.filter((g) => g.open !== false).map((g) => {
              const min = Math.min(...(g.packs || []).map((p) => p.price));
              return (
                <Link key={g.id} className="event-card hot-card" to={`/game/${g.id}`}>
                  <div className="hot-art game-tile" style={{ "--h": g.hue }}>
                    <img
                      className="event-img"
                      src={g.image || fallbackArt(g)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        const fb = fallbackArt(g);
                        if (fb && e.currentTarget.src.indexOf(fb) < 0) e.currentTarget.src = fb;
                        else e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="hot-badge">{t(lang, "hot")}</span>
                  </div>
                  <div className="hot-foot">
                    <strong className="hot-name">{g.name}</strong>
                    <span className="hot-price">{lang === "km" ? `ចាប់ពី ${money(min)}` : `From ${money(min)}`}</span>
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
          <h2 className="sec-title"><Icon name="star" size={18} /> {t(lang, "famous")}</h2>
        </div>
        <p className="section-sub">{t(lang, "famousSub")}</p>
        <div className="game-grid game-grid-3">
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
            <h2 className="sec-title"><Icon name="game" size={18} /> {t(lang, "all")}</h2>
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
        <div className="game-grid game-grid-3">
          {loading ? (
            <GameSkeletons />
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
            <div className="stat-value">{ticker ? Number(ticker.sold || 0).toLocaleString() : "…"}</div>
            <div className="stat-label">{t(lang, "statOrders")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="game" size={22} />
            </div>
            <div className="stat-value">{loading && !games.length ? "…" : games.filter((g) => g.open !== false).length}</div>
            <div className="stat-label">{t(lang, "statGames")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="zap" size={22} />
            </div>
            <div className="stat-value">{ticker ? fmtDuration(ticker.avgDeliverySec, lang) : "…"}</div>
            <div className="stat-label">{t(lang, "statSpeed")}</div>
          </div>
          <div className="stat">
            <div className="stat-icon">
              <Icon name="help" size={22} />
            </div>
            <div className="stat-value stat-hours">{(ticker && ticker.delivery) || SHOP_HOURS}</div>
            <div className="stat-label">{t(lang, "statChat")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
