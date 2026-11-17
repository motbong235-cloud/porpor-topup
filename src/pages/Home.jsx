import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { money } from "../lib/store";
import { t } from "../lib/i18n";
import { GameTile, Icon } from "../components/Icons";
import { GameIcon, GiftIcon } from "../components/CategoryIcons";
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

function GameCard({ game, top }) {
  const from = minPackPrice(game);
  const open = game.open !== false;

  const body = (
    <div className="game-card-visual">
      <div className="game-card-pad">
        {top ? (
          <div className="game-badge hot">
            <Icon name="star" size={10} />
            <span className="badge-top-text">TOP</span>
          </div>
        ) : null}
        {!open ? <div className="game-badge off">OFF</div> : null}
        <div className="game-card-art">
          <GameTile game={game} />
        </div>
      </div>
      <div className="game-card-body">
        <h3 className="game-name" title={game.name}>
          {game.name}
        </h3>
        {from != null && open ? <div className="game-from">From {money(from)}</div> : null}
        {open ? (
          <span className="game-cta on">
            <Icon name="zap" size={11} />
            TOP UP
          </span>
        ) : (
          <span className="game-cta off">UNAVAILABLE</span>
        )}
      </div>
    </div>
  );

  if (!open) {
    return <div className="game-card sf-card disabled">{body}</div>;
  }
  return (
    <Link className="game-card sf-card card-hover" to={`/game/${game.id}`} aria-label={game.name}>
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
  const [tab, setTab] = useState("game");
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

  return (
    <div className="container natsu-home">
      <FallingPetals />

      <nav className="natsu-cats catalog-categories" aria-label="Shop by category">
        <div className="catalog-categories__items">
          <button
            type="button"
            className={`natsu-cat catalog-categories__item${tab === "game" ? " active" : ""}`}
            data-catalog-category="game"
            onClick={() => setTab("game")}
          >
            <span className="natsu-cat-ico catalog-categories__badge premium-ico" aria-hidden>
              <GameIcon size={36} />
            </span>
            <span className="catalog-categories__label">Game</span>
          </button>
          <button
            type="button"
            className={`natsu-cat catalog-categories__item${tab === "gift" ? " active" : ""}`}
            data-catalog-category="giftcard"
            onClick={() => setTab("gift")}
          >
            <span className="natsu-cat-ico catalog-categories__badge premium-ico" aria-hidden>
              <GiftIcon size={36} />
            </span>
            <span className="catalog-categories__label">Giftcard</span>
          </button>
        </div>
        <a className="natsu-viewall catalog-categories__all" href="#games">
          View all
        </a>
      </nav>

      <section className="section" id="trending">
        <div className="section-head natsu-sec-head">
          <h2 className="sec-title natsu-trending-title">
            <span className="featured-heading__icon-badge" aria-hidden>
              <Icon name="star" size={14} />
            </span>
            Trending Game
          </h2>
          <span className="natsu-pill">
            <Icon name="star" size={12} />
            {trending.length} items
          </span>
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
