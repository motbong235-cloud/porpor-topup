import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { money } from "../lib/store";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "../components/Icons";
import { FallingPetals } from "../components/FallingPetals";

function isGift(g) {
  const k = `${g?.id || ""} ${g?.name || ""} ${g?.mark || ""}`.toLowerCase();
  return /gift|gc|card|voucher|steam.?wallet/.test(k);
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

/** Natsu-style game card: art + name + TOP UP */
function GameCard({ game, top }) {
  const from = minPackPrice(game);
  const open = game.open !== false;

  const body = (
    <>
      {top ? <span className="game-badge hot">★ TOP</span> : null}
      {!open ? <span className="game-badge off">OFF</span> : null}
      <div className="game-card-art">
        <GameTile game={game} />
      </div>
      <div className="game-card-body">
        <div className="game-name">{game.name}</div>
        {from != null && open ? <div className="game-from">From {money(from)}</div> : null}
        {open ? <span className="game-cta on">TOP UP</span> : <span className="game-cta off">UNAVAILABLE</span>}
      </div>
    </>
  );

  if (!open) {
    return <div className="game-card sf-card disabled">{body}</div>;
  }
  return (
    <Link className="game-card sf-card card-hover" to={`/game/${game.id}`}>
      {body}
    </Link>
  );
}

function GameSkeletons({ n = 6 }) {
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
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState("game"); // game | gift
  const [filter, setFilter] = useState("");

  const list = useMemo(() => {
    let g = games.filter((x) => x);
    if (tab === "gift") g = g.filter(isGift);
    else g = g.filter((x) => !isGift(x));
    const q = filter.trim().toLowerCase();
    if (q) {
      g = g.filter((x) => {
        const name = String(x?.name || "").toLowerCase();
        const mark = String(x?.mark || "").toLowerCase();
        const nameKm = String(x?.nameKm || "").toLowerCase();
        return name.includes(q) || mark.includes(q) || nameKm.includes(q);
      });
    }
    return g;
  }, [games, tab, filter]);

  const trending = useMemo(() => {
    const base = list.filter((g) => g.open !== false);
    const hot = base.filter((g) => g.famous || g.hot);
    const pool = hot.length ? hot : base;
    return pool.slice(0, 6);
  }, [list]);

  const custom = (settings && Array.isArray(settings.bannerUrls) ? settings.bannerUrls : []).filter(Boolean);
  const hasCustom = custom.length > 0;
  const count = hasCustom ? custom.length : 2;

  useEffect(() => {
    setSlide(0);
  }, [count]);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % count), 5600);
    return () => clearInterval(id);
  }, [count]);

  return (
    <div className="container natsu-home">
      <FallingPetals />

      {/* Banner */}
      <section className={`banner banner-v2${hasCustom ? " banner-has-photo" : ""}`}>
        {hasCustom
          ? custom.map((url, i) => (
              <div key={url + i} className={`banner-slide banner-photo${i === slide ? " active" : ""}`}>
                <img src={url} alt="" loading={i === 0 ? "eager" : "lazy"} />
              </div>
            ))
          : [
              { tone: "banner-deep", title: "Welcome to Porpor Topup", sub: lang === "km" ? "ទិញ Diamond · UC · Robux លឿន សុវត្ថិភាព" : "Fast · Safe game top-up" },
              { tone: "banner-ice", title: lang === "km" ? "តម្លៃល្អ · ដឹកភ្លាម" : "Best rate · Instant", sub: lang === "km" ? "MLBB · Free Fire · PUBG · Roblox" : "MLBB · Free Fire · PUBG · Roblox" },
            ].map((s, i) => (
              <div key={s.tone} className={`banner-slide ${s.tone}${i === slide ? " active" : ""}`}>
                <div className="banner-copy">
                  <div className="kicker">
                    <span className="kicker-dot" />
                    PORPOR TOPUP
                  </div>
                  <h1 className="banner-title">{s.title}</h1>
                  <p className="banner-sub">{s.sub}</p>
                  <div className="banner-actions">
                    <a className="btn bg-brand" href="#trending">
                      TOP UP
                    </a>
                    <a className="btn btn-ghost" href="#games">
                      {lang === "km" ? "មើលហ្គេម" : "All games"}
                    </a>
                  </div>
                </div>
              </div>
            ))}
        {count > 1 && (
          <div className="banner-dots">
            {Array.from({ length: count }, (_, i) => i).map((i) => (
              <button key={i} type="button" className={`dot${i === slide ? " active" : ""}`} onClick={() => setSlide(i)} />
            ))}
          </div>
        )}
      </section>

      {/* Category tabs — SVG icons instead of emoji */}
      <div className="natsu-cats" role="tablist">
        <button
          type="button"
          role="tab"
          className={`natsu-cat${tab === "game" ? " active" : ""}`}
          onClick={() => setTab("game")}
        >
          <span className="natsu-cat-ico" aria-hidden>
            <Icon name="game" size={22} />
          </span>
          Game
        </button>
        <button
          type="button"
          role="tab"
          className={`natsu-cat${tab === "gift" ? " active" : ""}`}
          onClick={() => setTab("gift")}
        >
          <span className="natsu-cat-ico" aria-hidden>
            <Icon name="gift" size={22} />
          </span>
          Giftcard
        </button>
        <a className="natsu-viewall" href="#games">
          View all
        </a>
      </div>

      {/* Trending */}
      <section className="section" id="trending">
        <div className="section-head natsu-sec-head">
          <h2 className="sec-title">
            <span className="natsu-star">★</span> Trending Game
          </h2>
          <span className="natsu-pill">{trending.length} items</span>
        </div>
        <div className="game-grid game-grid-3">
          {loading ? (
            <GameSkeletons n={6} />
          ) : trending.length === 0 ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {lang === "km" ? "មិនទាន់មាន game" : "No games yet"}
            </div>
          ) : (
            trending.map((g) => <GameCard key={g.id} game={g} top />)
          )}
        </div>
      </section>

      {/* All games */}
      <section className="section" id="games">
        <div className="toolbar natsu-toolbar">
          <div className="section-head" style={{ margin: 0 }}>
            <h2 className="sec-title">
              <span className="natsu-star">◆</span> All Games
            </h2>
          </div>
          <input
            className="search-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t(lang, "searchPh")}
            aria-label="Search"
          />
        </div>
        <p className="count">{list.length} games</p>
        <div className="game-grid game-grid-3">
          {loading ? (
            <GameSkeletons />
          ) : error ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "catalogError")}
            </div>
          ) : list.length === 0 ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {t(lang, "searchEmpty")}
            </div>
          ) : (
            list.map((g) => <GameCard key={g.id} game={g} top={!!(g.famous || g.hot)} />)
          )}
        </div>
      </section>
    </div>
  );
}
