import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { money } from "../lib/store";
import { Icon } from "../components/Icons";

/**
 * Public page: special packages grouped by service (game).
 * Admin configures items in Settings / Special Items admin.
 */
export default function SpecialItems({ lang, settings }) {
  const { games } = useCatalog();
  const items = Array.isArray(settings?.specialItems) ? settings.specialItems : [];
  const [serviceId, setServiceId] = useState("all");

  const gameMap = useMemo(() => {
    const m = new Map();
    for (const g of games || []) m.set(String(g.id), g);
    return m;
  }, [games]);

  /** group by gameId */
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it || it.enabled === false) continue;
      const gid = String(it.gameId || "_other");
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid).push(it);
    }
    // sort packs within group
    for (const list of map.values()) {
      list.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
    }
    return map;
  }, [items]);

  const serviceTabs = useMemo(() => {
    const tabs = [{ id: "all", name: lang === "km" ? "ទាំងអស់" : "All" }];
    for (const [gid, list] of groups) {
      if (gid === "_other") {
        tabs.push({ id: gid, name: lang === "km" ? "ផ្សេងៗ" : "Other", count: list.length });
        continue;
      }
      const g = gameMap.get(gid);
      tabs.push({
        id: gid,
        name: g ? (lang === "km" && g.nameKm ? g.nameKm : g.name) : gid,
        count: list.length,
      });
    }
    return tabs;
  }, [groups, gameMap, lang]);

  const visibleGroups = useMemo(() => {
    if (serviceId === "all") return Array.from(groups.entries());
    if (!groups.has(serviceId)) return [];
    return [[serviceId, groups.get(serviceId)]];
  }, [groups, serviceId]);

  return (
    <div className="container si-page">
      <div className="si-page-hero">
        <div className="si-page-hero-text">
          <p className="si-page-kicker">{lang === "km" ? "POR POR" : "POR POR"}</p>
          <h1>{lang === "km" ? "កញ្ចប់ពិសេសតាមសេវា" : "Special packs by service"}</h1>
          <p className="si-page-lead">
            {lang === "km"
              ? "ជ្រើស service → មើលកញ្ចប់ដែលហាងរៀបចំសម្រាប់ service នោះ"
              : "Pick a service to see curated packs for that game"}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/">
          {lang === "km" ? "← ទំព័រដើម" : "← Home"}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="si-empty card">
          <Icon name="star" size={28} />
          <p>
            {lang === "km"
              ? "មិនទាន់មានកញ្ចប់ពិសេស — Admin បន្ថែមក្នុង Settings / Special Items"
              : "No special packs yet — Admin can add them in Settings"}
          </p>
        </div>
      ) : (
        <>
          <div className="si-tabs" role="tablist">
            {serviceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={serviceId === tab.id}
                className={"si-tab" + (serviceId === tab.id ? " on" : "")}
                onClick={() => setServiceId(tab.id)}
              >
                {tab.name}
                {tab.count != null ? <span className="si-tab-n">{tab.count}</span> : null}
              </button>
            ))}
          </div>

          <div className="si-groups">
            {visibleGroups.map(([gid, list]) => {
              const g = gameMap.get(gid);
              const serviceName =
                gid === "_other"
                  ? lang === "km"
                    ? "ផ្សេងៗ"
                    : "Other"
                  : g
                    ? lang === "km" && g.nameKm
                      ? g.nameKm
                      : g.name
                    : gid;
              return (
                <section key={gid} className="si-group">
                  <div className="si-group-head">
                    <div className="si-group-title">
                      <span className="si-group-mark">{(serviceName || "?").slice(0, 2).toUpperCase()}</span>
                      <div>
                        <h2>{serviceName}</h2>
                        <p>
                          {list.length} {lang === "km" ? "កញ្ចប់" : "packs"}
                          {g?.open === false
                            ? lang === "km"
                              ? " · សេវាបិទ"
                              : " · closed"
                            : ""}
                        </p>
                      </div>
                    </div>
                    {g ? (
                      <Link className="si-group-link" to={`/game/${encodeURIComponent(g.id)}`}>
                        {lang === "km" ? "មើល service →" : "Open service →"}
                      </Link>
                    ) : null}
                  </div>
                  <div className="si-grid">
                    {list.map((it) => {
                      const title =
                        lang === "km" && it.titleKm ? it.titleKm : it.title || it.titleKm || "—";
                      const href = it.gameId
                        ? `/game/${encodeURIComponent(it.gameId)}${
                            it.packId ? `?pack=${encodeURIComponent(it.packId)}` : ""
                          }`
                        : "#";
                      return (
                        <Link key={it.id || title + it.price} className="si-card si-card-page si-card-text" to={href}>
                          <div className="si-card-inner">
                            <span className="si-badge">{it.badge || "SPECIAL"}</span>
                            <div className="si-meta">
                              <strong className="si-title">{title}</strong>
                              {it.subtitle ? <span className="si-sub">{it.subtitle}</span> : null}
                              <span className="si-price">{money(Number(it.price) || 0)}</span>
                            </div>
                            <span className="si-cta">{lang === "km" ? "ទិញឥឡូវ" : "Buy now"}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
