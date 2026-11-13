import { useEffect, useMemo, useState } from "react";
import { AIcon, PageHead, api, toast } from "./ui";
import { useCatalog } from "../../lib/catalog";

/**
 * Easy admin: pick a service → tick packs to show as Special Items.
 */
export default function SpecialItemsAdmin() {
  const { games, loading: catLoading } = useCatalog();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api("/api/admin/settings")
      .then((s) => setItems(Array.isArray(s.specialItems) ? s.specialItems : []))
      .catch(() => toast("ទាញ settings មិនបាន", "bad"))
      .finally(() => setLoading(false));
  }, []);

  const openGames = useMemo(() => (games || []).filter((g) => g && g.id), [games]);

  const filteredGames = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return openGames;
    return openGames.filter(
      (g) =>
        String(g.name || "").toLowerCase().includes(s) ||
        String(g.nameKm || "").toLowerCase().includes(s) ||
        String(g.id || "").toLowerCase().includes(s),
    );
  }, [openGames, q]);

  const counts = useMemo(() => {
    const m = {};
    for (const it of items) {
      const k = String(it.gameId || "");
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [items]);

  const service = openGames.find((g) => String(g.id) === String(serviceId)) || null;
  const packs = Array.isArray(service?.packs) ? service.packs : [];

  const specialPackIds = useMemo(() => {
    const set = new Set();
    for (const it of items) {
      if (String(it.gameId) === String(serviceId) && it.packId) set.add(String(it.packId));
    }
    return set;
  }, [items, serviceId]);

  function isOn(packId) {
    return specialPackIds.has(String(packId));
  }

  function togglePack(pack) {
    if (!service) return;
    const pid = String(pack.id);
    const on = isOn(pid);
    if (on) {
      setItems((list) =>
        list.filter(
          (it) => !(String(it.gameId) === String(service.id) && String(it.packId) === pid),
        ),
      );
    } else {
      setItems((list) => [
        ...list,
        {
          id: `si-${Date.now()}-${pid}`,
          enabled: true,
          title: pack.name || "",
          titleKm: pack.nameKm || pack.name || "",
          subtitle: service.name || "",
          price: Number(pack.price) || 0,
          gameId: String(service.id),
          packId: pid,
          badge: "SPECIAL",
          image: pack.image || service.image || "",
          sort: list.length,
        },
      ]);
    }
    setDirty(true);
  }

  function setBadge(packId, badge) {
    setItems((list) =>
      list.map((it) =>
        String(it.gameId) === String(serviceId) && String(it.packId) === String(packId)
          ? { ...it, badge }
          : it,
      ),
    );
    setDirty(true);
  }

  function setImage(packId, image) {
    setItems((list) =>
      list.map((it) =>
        String(it.gameId) === String(serviceId) && String(it.packId) === String(packId)
          ? { ...it, image }
          : it,
      ),
    );
    setDirty(true);
  }

  function setEnabled(packId, enabled) {

    setItems((list) =>
      list.map((it) =>
        String(it.gameId) === String(serviceId) && String(it.packId) === String(packId)
          ? { ...it, enabled }
          : it,
      ),
    );
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
      toast("បានរក្សាទុក · ឃើញនៅ /special និង homepage");
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
    <div className="si-admin">
      <PageHead
        km="កញ្ចប់ពិសេស"
        en="ជ្រើស service → ចុចកញ្ចប់ដើម្បីដាក់/ដកពី Special · user មើលនៅ /special"
      />

      {/* sticky save */}
      <div className="si-admin-bar">
        <div className="si-admin-bar-info">
          <b>{items.filter((x) => x.enabled !== false).length}</b> កញ្ចប់កំពុងបង្ហាញ
          {dirty ? <span className="si-admin-dirty"> · មានការផ្លាស់ប្តូរ</span> : null}
        </div>
        <div className="si-admin-bar-actions">
          {serviceId ? (
            <button type="button" className="ad-btn" onClick={() => setServiceId("")}>
              ← ត្រឡប់ជ្រើស Service
            </button>
          ) : null}
          <button type="button" className="ad-btn primary" disabled={!dirty || saving} onClick={save}>
            {saving ? "…" : "រក្សាទុក"}
          </button>
        </div>
      </div>

      {/* STEP 1: pick service */}
      {!serviceId ? (
        <div className="ad-card">
          <h3 className="ad-card-title">១. ជ្រើស Service</h3>
          <p className="ad-hint">ចុច card មួយ — បន្ទាប់មកជ្រើសកញ្ចប់ដែលចង់ដាក់ Special</p>
          <input
            className="ad-input"
            style={{ marginBottom: 12, maxWidth: 360 }}
            placeholder="ស្វែងរក service…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {catLoading ? (
            <p>កំពុងទាញ catalog…</p>
          ) : filteredGames.length === 0 ? (
            <p>មិនឃើញ service — ពិនិត្យ Admin → សេវាហ្គេម</p>
          ) : (
            <div className="si-svc-grid">
              {filteredGames.map((g) => {
                const n = counts[String(g.id)] || 0;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="si-svc-card"
                    onClick={() => setServiceId(String(g.id))}
                  >
                    <div className="si-svc-art">
                      {g.image ? (
                        <img src={g.image} alt="" />
                      ) : (
                        <span>{String(g.name || "?").slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="si-svc-meta">
                      <strong>{g.name}</strong>
                      <span className="si-svc-id">{g.id}</span>
                      <span className={"si-svc-count" + (n ? " on" : "")}>
                        {n ? `${n} កញ្ចប់ពិសេស` : "មិនទាន់មាន"}
                      </span>
                    </div>
                    <span className="si-svc-go">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* STEP 2: packs for service */
        <div className="ad-card">
          <h3 className="ad-card-title">
            ២. កញ្ចប់ · {service?.name || serviceId}
          </h3>
          <p className="ad-hint">
            ចុចកញ្ចប់ដើម្បី <b>ដាក់ / ដក</b> ពី Special Items · ពណ៌ខៀវ = កំពុងបង្ហាញ
          </p>
          {packs.length === 0 ? (
            <p>Service នេះគ្មាន pack ក្នុង catalog</p>
          ) : (
            <div className="si-pack-grid">
              {packs.map((p) => {
                const on = isOn(p.id);
                const row = items.find(
                  (it) =>
                    String(it.gameId) === String(serviceId) && String(it.packId) === String(p.id),
                );
                return (
                  <div key={p.id} className={"si-pack-card" + (on ? " on" : "")}>
                    <button
                      type="button"
                      className="si-pack-main"
                      onClick={() => togglePack(p)}
                    >
                      <span className="si-pack-check">{on ? <AIcon name="check" size={16} /> : <AIcon name="plus" size={16} />}</span>
                      <div className="si-pack-body">
                        <strong>{p.name}</strong>
                        <span className="si-pack-price">${Number(p.price || 0).toFixed(2)}</span>
                      </div>
                    </button>
                    {on && row ? (
                      <div className="si-pack-opts">
                        <label>
                          Badge
                          <select
                            value={row.badge || "SPECIAL"}
                            onChange={(e) => setBadge(p.id, e.target.value)}
                          >
                            <option value="SPECIAL">SPECIAL</option>
                            <option value="HOT">HOT</option>
                            <option value="SALE">SALE</option>
                            <option value="NEW">NEW</option>
                          </select>
                        </label>
                        <label style={{ flex: "1 1 100%" }}>
                          រូបកញ្ចប់ (URL)
                          <input
                            type="url"
                            placeholder="https://… ស្រេចចិត្ត"
                            value={row.image || ""}
                            onChange={(e) => setImage(p.id, e.target.value)}
                          />
                        </label>
                        <label className="si-pack-en">
                          <input
                            type="checkbox"
                            checked={row.enabled !== false}
                            onChange={(e) => setEnabled(p.id, e.target.checked)}
                          />
                          បង្ហាញ
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* summary list */}
      {items.length > 0 && !serviceId ? (
        <div className="ad-card" style={{ marginTop: 14 }}>
          <h3 className="ad-card-title">បញ្ជី Special ទាំងអស់</h3>
          <div className="si-summary">
            {items.map((it, i) => {
              const g = openGames.find((x) => String(x.id) === String(it.gameId));
              return (
                <div key={it.id || i} className="si-summary-row">
                  <span className={"si-dot" + (it.enabled === false ? " off" : "")} />
                  <span className="si-summary-svc">{g?.name || it.gameId || "—"}</span>
                  <span className="si-summary-title">{it.title || it.titleKm}</span>
                  <span className="si-summary-price">${Number(it.price || 0).toFixed(2)}</span>
                  <button
                    type="button"
                    className="ad-btn"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => {
                      setItems((list) => list.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    លុប
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
