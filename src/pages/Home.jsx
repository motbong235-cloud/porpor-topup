import { useMemo, useState } from "react";
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

/** Natsu-style compact game card */
function GameCard({ game, top }) {
  const from = minPackPrice(game);
  const open = game.open !== false;

  const body = (
    <>
      <div className="game-card-art">
        {top ? (
          <span className="game-badge hot">
            <span className="badge-star">★</span> TOP
          </span>
        ) : null}
        {!open ? <span className="game-badge off">OFF</span> : null}
        <GameTile game={game} />
      </div>
      <div className="game-card-body">
        <div className="game-name">{game.name}</div>
        {from != null && open ? <div className="game-from">From {money(from)}</div> : null}
        {open ? (
          <span className="game-cta on">
            <span className="cta-bolt">⚡</span> TOP UP
          </span>
        ) : (
          <span className="game-cta off">UNAVAILABLE</span>
        )}
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

      {/* Category tabs — match Natsu Game / Giftcard */}
      <div className="natsu-cats" role="tablist">
        <button
          type="button"
          role="tab"
          className={`natsu-cat${tab === "game" ? " active" : ""}`}
          onClick={() => setTab("game")}
        >
          <span className="natsu-cat-ico" aria-hidden>
            <Icon name="game" size={24} />
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
            <Icon name="gift" size={24} />
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
          <h2 className="sec-title natsu-trending-title">
            <span className="natsu-star">★</span> Trending Game
          </h2>
          <span className="natsu-pill">
            <span className="pill-star">★</span> {trending.length} items
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
