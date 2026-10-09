import { useEffect, useMemo, useState } from "react";
import { api } from "./AdminLayout";

const blank = { enabled: false, featured: false, markup: null, packages: null };

function sellPrice(cost, markup) {
  return Math.ceil(cost * (1 + (Number(markup) || 0) / 100) * 100 - 1e-9) / 100;
}

export default function ServicesAdmin() {
  const [games, setGames] = useState(null);
  const [sel, setSel] = useState({ markupPercent: 0, games: {} });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const [raw, setRaw] = useState(null);

  function load() {
    setErr("");
    setGames(null);
    api("/api/admin/kt-games")
      .then((d) => {
        setGames(d.games || []);
        setSel({ markupPercent: d.selection?.markupPercent || 0, games: d.selection?.games || {} });
      })
      .catch((e) => {
        setErr(e.message || "Could not load Khmer TopUp games");
        setGames([]);
      });
  }

  useEffect(load, []);

  function patch(slug, p) {
    setSel((s) => ({ ...s, games: { ...s.games, [slug]: { ...blank, ...(s.games[slug] || {}), ...p } } }));
  }

  function togglePack(g, id) {
    const cur = sel.games[g.slug]?.packages;
    const set = new Set(cur || g.packs.map((p) => p.id));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch(g.slug, { packages: set.size === g.packs.length ? null : Array.from(set) });
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await api("/api/admin/kt-selection", { method: "PUT", body: JSON.stringify(sel) });
      setMsg("Saved ✓");
    } catch {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function showRaw() {
    try {
      const d = await api("/api/admin/kt-games?raw=1");
      setRaw(JSON.stringify((d.raw || []).slice(0, 1), null, 2));
    } catch (e) {
      setRaw(String(e.message));
    }
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (games || []).filter((g) => !s || g.name.toLowerCase().includes(s) || g.slug.toLowerCase().includes(s));
  }, [games, q]);

  const enabledCount = Object.values(sel.games).filter((g) => g.enabled).length;

  return (
    <div>
      <h1 className="page-title">Services</h1>
      <p className="page-lead">
        Games and packages pulled live from Khmer TopUp. Tick what you want to sell — only selected ones appear in the
        store.
      </p>

      {err ? <p style={{ color: "var(--danger)" }}>{err}</p> : null}

      <div className="settings-form" style={{ marginBottom: 16 }}>
        <div className="row2">
          <div className="field">
            <label>Default markup (%) added on top of Khmer TopUp price</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={sel.markupPercent}
              onChange={(e) => setSel((s) => ({ ...s, markupPercent: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Game name…" />
          </div>
        </div>
        <div className="save-bar">
          <button type="button" className="bg-brand" disabled={saving || !games} onClick={save}>
            {saving ? "Saving…" : `Save selection (${enabledCount} games)`}
          </button>
          <button type="button" className="btn-soft" onClick={load}>
            Reload from Khmer TopUp
          </button>
          <button type="button" className="btn-soft" onClick={showRaw}>
            Raw API sample
          </button>
          {msg ? <span className={`msg ${msg.includes("fail") ? "err" : "ok"}`}>{msg}</span> : null}
        </div>
        {raw ? (
          <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 240, background: "var(--card, #fff)", padding: 12, borderRadius: 8 }}>
            {raw}
          </pre>
        ) : null}
      </div>

      {!games ? <p style={{ color: "var(--muted)" }}>Loading…</p> : null}
      {games && !err && games.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Khmer TopUp returned no games (or the response format was not recognised — check “Raw API sample”).</p>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {list.map((g) => {
          const s = { ...blank, ...(sel.games[g.slug] || {}) };
          const markup = s.markup === null || s.markup === "" ? sel.markupPercent : s.markup;
          const chosen = s.packages ? new Set(s.packages) : new Set(g.packs.map((p) => p.id));
          const isOpen = open === g.slug;
          return (
            <div key={g.slug} className="settings-form" style={{ padding: 12, border: "1px solid var(--line, #dde6f3)", borderRadius: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                <label className="check-row" style={{ flex: "1 1 220px" }}>
                  <input type="checkbox" checked={s.enabled} onChange={(e) => patch(g.slug, { enabled: e.target.checked })} />
                  <strong>{g.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {g.slug} · {g.packs.length} packages
                  </span>
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={s.featured} onChange={(e) => patch(g.slug, { featured: e.target.checked })} />
                  Featured
                </label>
                <label className="check-row" title="Leave empty to use the default markup">
                  Markup %
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    style={{ width: 80 }}
                    value={s.markup ?? ""}
                    placeholder={String(sel.markupPercent)}
                    onChange={(e) => patch(g.slug, { markup: e.target.value === "" ? null : e.target.value })}
                  />
                </label>
                <button type="button" className="btn-soft" onClick={() => setOpen(isOpen ? "" : g.slug)}>
                  {isOpen ? "Hide packages" : `Packages (${chosen.size}/${g.packs.length})`}
                </button>
              </div>

              {isOpen ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button type="button" className="btn-soft" onClick={() => patch(g.slug, { packages: null })}>
                      Select all
                    </button>
                    <button type="button" className="btn-soft" onClick={() => patch(g.slug, { packages: [] })}>
                      Select none
                    </button>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th />
                          <th>Package</th>
                          <th>Category</th>
                          <th>Cost</th>
                          <th>Sell</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.packs.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <input type="checkbox" checked={chosen.has(p.id)} onChange={() => togglePack(g, p.id)} />
                            </td>
                            <td>{p.name}</td>
                            <td>{p.category}</td>
                            <td>${p.cost.toFixed(2)}</td>
                            <td>${sellPrice(p.cost, markup).toFixed(2)}</td>
                            <td>{p.inStock ? "✓" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
