import { useEffect, useMemo, useState } from "react";
import { AIcon, PageHead, api, toast } from "./ui";
import { useCatalog } from "../../lib/catalog";

/**
 * Admin: arrange special packages per service.
 * Saves into settings.specialItems (same field as Settings section).
 */
export default function SpecialItemsAdmin() {
  const { games, loading: catLoading } = useCatalog();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api("/api/admin/settings")
      .then((s) => {
        setItems(Array.isArray(s.specialItems) ? s.specialItems : []);
      })
      .catch(() => toast("ទាញ settings មិនបាន", "bad"))
      .finally(() => setLoading(false));
  }, []);

  const openGames = useMemo(
    () => (games || []).filter((g) => g && g.id),
    [games],
  );

  const packsFor = (gameId) => {
    const g = openGames.find((x) => String(x.id) === String(gameId));
    return Array.isArray(g?.packs) ? g.packs : [];
  };

  const filtered = useMemo(() => {
    if (serviceFilter === "all") return items;
    return items.filter((it) => String(it.gameId || "") === String(serviceFilter));
  }, [items, serviceFilter]);

  function update(i, patch) {
    // i is index in full items array
    setItems((list) => list.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    setDirty(true);
  }

  function addForService(gameId) {
    const g = openGames.find((x) => String(x.id) === String(gameId));
    const packs = packsFor(gameId);
    const first = packs[0];
    setItems((list) => [
      ...list,
      {
        id: `si-${Date.now()}`,
        enabled: true,
        title: first?.name || g?.name || "",
        titleKm: first?.nameKm || "",
        subtitle: g?.name || "",
        price: first?.price ?? 0,
        gameId: String(gameId || ""),
        packId: first?.id || "",
        badge: "SPECIAL",
        image: first?.image || g?.image || "",
        sort: list.length,
      },
    ]);
    setServiceFilter(String(gameId));
    setDirty(true);
  }

  function removeAt(globalIndex) {
    setItems((list) => list.filter((_, j) => j !== globalIndex));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ specialItems: items }),
      });
      setItems(Array.isArray(saved.specialItems) ? saved.specialItems : items);
      setDirty(false);
      toast("បានរក្សាទុក Special Items");
    } catch {
      toast("រក្សាទុកមិនបាន", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="ad-loading">
        <span className="ad-spin" /> កំពុងផ្ទុក…
      </div>
    );
  }

  return (
    <div className="ad-special-page">
      <PageHead
        km="កញ្ចប់ពិសេសតាម Service"
        en="Organize special packs per game service — shown on /special and homepage"
      />

      <div className="ad-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label className="ad-field" style={{ margin: 0, minWidth: 180 }}>
            <span>តម្រង Service</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="all">ទាំងអស់ ({items.length})</option>
              {openGames.map((g) => {
                const n = items.filter((it) => String(it.gameId) === String(g.id)).length;
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} ({n})
                  </option>
                );
              })}
            </select>
          </label>

          <label className="ad-field" style={{ margin: 0, minWidth: 200 }}>
            <span>បន្ថែមសម្រាប់ Service</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) addForService(v);
                e.target.value = "";
              }}
              disabled={catLoading}
            >
              <option value="">— ជ្រើស service —</option>
              {openGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="ad-btn primary"
            disabled={!dirty || saving}
            onClick={save}
            style={{ marginTop: 18 }}
          >
            {saving ? "…" : dirty ? "រក្សាទុក" : "រក្សាទុកហើយ"}
          </button>
        </div>
        <p className="ad-hint" style={{ marginTop: 10 }}>
          ទំព័រ user: <code>/special</code> · homepage strip ប្រើ list តែមួយនេះ
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="ad-card">
          <p>មិនទាន់មាន item — ជ្រើស service ខាងលើដើម្បីបន្ថែមកញ្ចប់។</p>
        </div>
      ) : (
        filtered.map((it) => {
          const globalIndex = items.findIndex((x) => x === it || (x.id && x.id === it.id));
          const packs = packsFor(it.gameId);
          return (
            <div key={it.id || globalIndex} className="ad-card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <strong>
                  #{globalIndex + 1} · {it.title || it.titleKm || "Untitled"}
                </strong>
                <button type="button" className="ad-btn" onClick={() => removeAt(globalIndex)}>
                  លុប
                </button>
              </div>
              <div className="ad-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="ad-field">
                  <span>Service (gameId)</span>
                  <select
                    value={it.gameId || ""}
                    onChange={(e) => {
                      const gid = e.target.value;
                      const packs2 = packsFor(gid);
                      const p0 = packs2[0];
                      update(globalIndex, {
                        gameId: gid,
                        packId: p0?.id || "",
                        price: p0?.price ?? it.price,
                        subtitle: openGames.find((g) => String(g.id) === gid)?.name || it.subtitle,
                      });
                    }}
                  >
                    <option value="">—</option>
                    {openGames.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ad-field">
                  <span>Pack</span>
                  <select
                    value={it.packId || ""}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const p = packs.find((x) => String(x.id) === pid);
                      update(globalIndex, {
                        packId: pid,
                        title: p?.name || it.title,
                        price: p?.price ?? it.price,
                        image: p?.image || it.image,
                      });
                    }}
                  >
                    <option value="">— ជ្រើស pack —</option>
                    {packs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · ${Number(p.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ad-field">
                  <span>Title EN</span>
                  <input
                    value={it.title || ""}
                    onChange={(e) => update(globalIndex, { title: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Title KM</span>
                  <input
                    value={it.titleKm || ""}
                    onChange={(e) => update(globalIndex, { titleKm: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Subtitle</span>
                  <input
                    value={it.subtitle || ""}
                    onChange={(e) => update(globalIndex, { subtitle: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Price $</span>
                  <input
                    type="number"
                    step="0.01"
                    value={it.price ?? ""}
                    onChange={(e) => update(globalIndex, { price: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Badge</span>
                  <input
                    value={it.badge || "SPECIAL"}
                    onChange={(e) => update(globalIndex, { badge: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Image URL</span>
                  <input
                    value={it.image || ""}
                    onChange={(e) => update(globalIndex, { image: e.target.value })}
                  />
                </label>
                <label className="ad-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={it.enabled !== false}
                    onChange={(e) => update(globalIndex, { enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
                <label className="ad-field">
                  <span>Sort</span>
                  <input
                    type="number"
                    value={it.sort ?? 0}
                    onChange={(e) => update(globalIndex, { sort: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
            </div>
          );
        })
      )}

      {dirty && (
        <div style={{ position: "sticky", bottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="ad-btn primary" disabled={saving} onClick={save}>
            {saving ? "…" : "រក្សាទុកការផ្លាស់ប្តូរ"}
          </button>
        </div>
      )}
    </div>
  );
}
