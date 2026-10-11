import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AIcon, ImageSlot, PageHead, Switch, api, toast, usd } from "./ui";

const blank = { enabled: false, featured: false, markup: null, packages: null, image: "", packIcon: "", packImages: {} };

function sellPrice(cost, markup) {
  return Math.ceil(cost * (1 + (Number(markup) || 0) / 100) * 100 - 1e-9) / 100;
}

function markOf(name) {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* One game card                                                       */
/* ------------------------------------------------------------------ */
function GameCard({ g, s, defaultMarkup, isOpen, onToggleOpen, patch }) {
  const markup = s.markup === null || s.markup === "" ? defaultMarkup : s.markup;
  const chosen = s.packages ? new Set(s.packages) : new Set(g.packs.map((p) => p.id));
  const customPacks = Object.keys(s.packImages || {}).length;

  function togglePack(id) {
    const set = new Set(chosen);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch(g.slug, { packages: set.size === g.packs.length ? null : Array.from(set) });
  }

  function setPackImage(id, url) {
    const next = { ...(s.packImages || {}) };
    if (url) next[id] = url;
    else delete next[id];
    patch(g.slug, { packImages: next });
  }

  return (
    <article className={`ad-game${s.enabled ? " on" : ""}`}>
      <div className="ad-game-main">
        <ImageSlot
          size={76}
          round={18}
          src={s.image || g.image}
          fallback={markOf(g.name)}
          custom={!!s.image}
          label="Upload រូបហ្គេម"
          onUrl={(url) => patch(g.slug, { image: url })}
          onClear={() => patch(g.slug, { image: "" })}
        />
        <div className="ad-game-info">
          <div className="ad-game-name">{g.name}</div>
          <div className="ad-game-sub">
            {g.slug} · {g.packs.length} កញ្ចប់
          </div>
          <div className="ad-tags">
            {s.image ? <span className="ad-tag">រូបផ្ទាល់ខ្លួន</span> : null}
            {s.enabled ? <span className="ad-tag ok">កំពុងលក់ · {chosen.size} កញ្ចប់</span> : <span className="ad-tag">មិនលក់</span>}
          </div>
        </div>
        <div className="ad-game-sw">
          <Switch checked={s.enabled} onChange={(v) => patch(g.slug, { enabled: v })} label={`លក់ ${g.name}`} />
          <small>{s.enabled ? "បើក" : "បិទ"}</small>
        </div>
      </div>

      <div className="ad-game-controls">
        <button
          type="button"
          className={`ad-chip small${s.featured ? " active" : ""}`}
          onClick={() => patch(g.slug, { featured: !s.featured })}
          title="បង្ហាញក្នុងផ្នែកពេញនិយមលើទំព័រដើម"
        >
          <AIcon name="star" size={13} /> ពេញនិយម
        </button>
        <label className="ad-inline">
          បូកថែម %
          <input
            type="number"
            min="0"
            step="0.5"
            value={s.markup ?? ""}
            placeholder={String(defaultMarkup)}
            onChange={(e) => patch(g.slug, { markup: e.target.value === "" ? null : e.target.value })}
          />
        </label>
        <button type="button" className="ad-btn soft sm" onClick={onToggleOpen}>
          កញ្ចប់ ({chosen.size}/{g.packs.length}){customPacks ? ` · ${customPacks} រូប` : ""}
          <span className={`ad-chev${isOpen ? " up" : ""}`}>
            <AIcon name="chevron" size={14} />
          </span>
        </button>
      </div>

      {isOpen ? (
        <div className="ad-packs">
          <div className="ad-packs-tools">
            <div className="ad-default-icon">
              <ImageSlot
                size={48}
                round={12}
                src={s.packIcon}
                fallback="＋"
                custom={!!s.packIcon}
                label="Upload រូបកញ្ចប់ស្តង់ដារ"
                onUrl={(url) => patch(g.slug, { packIcon: url })}
                onClear={() => patch(g.slug, { packIcon: "" })}
              />
              <div>
                <strong>រូបកញ្ចប់ស្តង់ដារ</strong>
                <small>ប្រើជាមួយគ្រប់កញ្ចប់ដែលមិនទាន់មានរូបផ្ទាល់ខ្លួន</small>
              </div>
            </div>
            <div className="ad-packs-btns">
              <button type="button" className="ad-btn soft sm" onClick={() => patch(g.slug, { packages: null })}>
                ជ្រើសទាំងអស់
              </button>
              <button type="button" className="ad-btn soft sm" onClick={() => patch(g.slug, { packages: [] })}>
                ដកទាំងអស់
              </button>
            </div>
          </div>

          <div className="ad-pk-head">
            <span />
            <span>រូប</span>
            <span>កញ្ចប់</span>
            <span className="r">ដើម</span>
            <span className="r">លក់</span>
          </div>
          {g.packs.map((p) => {
            const custom = s.packImages?.[p.id] || "";
            const effective = custom || s.packIcon || p.image || "";
            return (
              <div key={p.id} className={`ad-pk${chosen.has(p.id) ? "" : " off"}`}>
                <input type="checkbox" checked={chosen.has(p.id)} onChange={() => togglePack(p.id)} aria-label={p.name} />
                <ImageSlot
                  size={44}
                  round={11}
                  src={effective}
                  fallback="＋"
                  custom={!!custom}
                  label={`Upload រូប ${p.name}`}
                  onUrl={(url) => setPackImage(p.id, url)}
                  onClear={() => setPackImage(p.id, "")}
                />
                <div className="ad-pk-name">
                  <strong>{p.name}</strong>
                  <small>
                    {p.category}
                    {p.inStock ? "" : " · អស់ស្តុក"}
                  </small>
                </div>
                <span className="r muted">{usd(p.cost)}</span>
                <span className="r price">{usd(sellPrice(p.cost, markup))}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/* ─── Local services (Gift cards / manual delivery) ─── */
function blankLocal() {
  return {
    id: "",
    name: "",
    nameKm: "",
    region: "Cambodia / Global",
    blurbKm: "បង់រួចទទួលកូដតាម Live Chat",
    blurbEn: "Pay then get code via Live Chat",
    famous: true,
    hot: true,
    open: true,
    hue: 210,
    mark: "GC",
    deliveryType: "gift_code",
    packs: [{ id: "", name: "", price: 0, cost: 0, category: "Gift Card" }],
  };
}



function LocalServicesPanel() {
  const [products, setProducts] = useState([]);
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState(0); // open first by default
  const [stockCounts, setStockCounts] = useState({});
  const [stockDraft, setStockDraft] = useState({});
  const [stockBusy, setStockBusy] = useState("");
  const [apiErr, setApiErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setApiErr("");
    try {
      const [d, st] = await Promise.all([
        api("/api/admin/local-products"),
        api("/api/admin/gift-stock").catch((e) => {
          setApiErr("gift-stock API មិនទាន់ deploy — ត្រូវ push server/index.js + store.js");
          return { counts: {} };
        }),
      ]);
      setProducts(Array.isArray(d.products) ? d.products : []);
      setUsingDefaults(!!d.usingDefaults);
      setStockCounts(st.counts || d.stockCounts || {});
    } catch (e) {
      setProducts([]);
      setApiErr(e.message || "មិនអាចទាញ services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(list) {
    setSaving(true);
    try {
      const d = await api("/api/admin/local-products", {
        method: "PUT",
        body: JSON.stringify({ products: list }),
      });
      setProducts(d.products || list);
      setUsingDefaults(false);
      toast("បានរក្សាទុក services");
    } catch {
      toast("រក្សាទុកមិនបាន", "bad");
    } finally {
      setSaving(false);
    }
  }

  async function saveStock(packId, mode) {
    const text = stockDraft[packId] ?? "";
    if (!String(text).trim() && mode === "append") {
      toast("សូមបិទកូដសិន", "bad");
      return;
    }
    setStockBusy(packId);
    try {
      const d = await api(`/api/admin/gift-stock/${encodeURIComponent(packId)}`, {
        method: "PUT",
        body: JSON.stringify({ codes: text, mode: mode || "replace" }),
      });
      setStockCounts((c) => ({ ...c, [packId]: d.count }));
      toast(mode === "append" ? `បន្ថែមស្តុក · សរុប ${d.count}` : `ស្តុកថ្មី · ${d.count} កូដ`);
      if (mode !== "append") setStockDraft((s) => ({ ...s, [packId]: "" }));
    } catch {
      toast("រក្សាទុកស្តុកមិនបាន — ពិនិត្យ deploy API gift-stock", "bad");
    } finally {
      setStockBusy("");
    }
  }

  function addProduct() {
    const id = `svc-${Date.now().toString(36)}`;
    const p = {
      id,
      name: "New Gift Service",
      nameKm: "សេវាកូដថ្មី",
      region: "Cambodia",
      blurbKm: "បង់រួចទទួលកូដស្វ័យប្រវត្តិ",
      blurbEn: "Pay then get code instantly",
      famous: true,
      hot: true,
      open: true,
      hue: 210,
      mark: "GC",
      image: "",
      deliveryType: "gift_code",
      packs: [{ id: `${id}-1`, name: "Pack 1", nameKm: "Pack 1", price: 1, cost: 1, category: "Gift Card", image: "" }],
    };
    setProducts((x) => [...x, p]);
    setEditIdx(products.length);
  }

  function updateAt(i, patch) {
    setProducts((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function updatePack(pi, pk, patch) {
    setProducts((list) =>
      list.map((p, idx) => {
        if (idx !== pi) return p;
        return { ...p, packs: (p.packs || []).map((x, j) => (j === pk ? { ...x, ...patch } : x)) };
      }),
    );
  }

  function addPack(pi) {
    setProducts((list) =>
      list.map((p, idx) => {
        if (idx !== pi) return p;
        const n = (p.packs || []).length + 1;
        return {
          ...p,
          packs: [...(p.packs || []), { id: `${p.id}-${n}`, name: `Pack ${n}`, nameKm: `Pack ${n}`, price: 1, cost: 1, category: "Gift Card", image: "" }],
        };
      }),
    );
  }

  function removePack(pi, pk) {
    setProducts((list) =>
      list.map((p, idx) => {
        if (idx !== pi) return p;
        return { ...p, packs: (p.packs || []).filter((_, j) => j !== pk) };
      }),
    );
  }

  function removeProduct(i) {
    if (!confirm("លុប service នេះ?")) return;
    setProducts((list) => list.filter((_, idx) => idx !== i));
    setEditIdx(0);
  }

  // Flatten all packs for the STOCK ZONE (always visible)
  const allPacks = [];
  products.forEach((p) => {
    (p.packs || []).forEach((pk) => {
      allPacks.push({ service: p.name || p.id, serviceId: p.id, pack: pk });
    });
  });

  return (
    <section
      className="card local-svc-panel"
      style={{
        marginBottom: 28,
        border: "2px solid #3b82f6",
        borderRadius: 16,
        padding: 16,
        background: "linear-gradient(180deg, rgba(59,130,246,0.08), transparent)",
      }}
    >
      {/* ===== BIG STOCK ZONE — always on top ===== */}
      <div
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 14,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", color: "#60a5fa" }}><AIcon name="box" size={24} /></span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#fff" }}>កន្លែងដាក់ស្តុកកូដ (Add Stock)</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              បិទកូដខាងក្រោម → ចុច «+ បន្ថែមស្តុក» · មួយបន្ទាត់ = មួយកូដ · អតិថិជនបង់រួចទទួលស្វ័យប្រវត្តិ
            </p>
          </div>
          <button type="button" className="ad-btn soft" onClick={load} disabled={loading}>
            <AIcon name="refresh" size={16} /> ផ្ទុក
          </button>
        </div>

        {apiErr ? (
          <div style={{ background: "#7f1d1d", color: "#fecaca", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
            <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6 }}><AIcon name="alert" size={16} /></span>{apiErr}
          </div>
        ) : null}

        {loading ? (
          <div className="ad-loading" style={{ color: "#94a3b8" }}>
            <span className="ad-spin" /> កំពុងផ្ទុក…
          </div>
        ) : allPacks.length === 0 ? (
          <div style={{ padding: 12, background: "#1e293b", borderRadius: 10, fontSize: 14 }}>
            មិនទាន់មាន pack — ចុច <b>+ Service</b> ខាងក្រោមជាមុន សិន រួចរក្សាទុក បន្ទាប់មកដាក់ស្តុកនៅទីនេះ។
          </div>
        ) : (
          allPacks.map(({ service, pack: pk }) => (
            <div
              key={pk.id}
              style={{
                background: "#1e293b",
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                border: "1px solid #334155",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff" }}>
                    {service} · {pk.name || pk.id}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    ID: <code style={{ color: "#93c5fd" }}>{pk.id}</code> · តម្លៃ ${Number(pk.price || 0).toFixed(2)}
                  </div>
                </div>
                <div
                  style={{
                    background: (stockCounts[pk.id] || 0) > 0 ? "#14532d" : "#7f1d1d",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  នៅសល់ {stockCounts[pk.id] || 0} កូដ
                </div>
              </div>
              <textarea
                rows={4}
                placeholder={"បិទកូដនៅទីនេះ...\nCODE-001\nCODE-002\nCODE-003"}
                value={stockDraft[pk.id] ?? ""}
                onChange={(e) => setStockDraft((s) => ({ ...s, [pk.id]: e.target.value }))}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  padding: 12,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 14,
                  border: "2px solid #3b82f6",
                  background: "#0f172a",
                  color: "#86efac",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ad-btn primary"
                  style={{ fontWeight: 700, padding: "10px 16px" }}
                  disabled={stockBusy === pk.id}
                  onClick={() => saveStock(pk.id, "append")}
                >
                  <AIcon name="box" size={16} /> បន្ថែមស្តុក
                </button>
                <button
                  type="button"
                  className="ad-btn soft"
                  disabled={stockBusy === pk.id}
                  onClick={() => {
                    if (confirm("ជំនួសស្តុកទាំងអស់?")) saveStock(pk.id, "replace");
                  }}
                >
                  ជំនួសស្តុក
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== Service editor ===== */}
      <div className="ad-head" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.05rem", margin: 0 }}>
            <AIcon name="box" size={20} /> កំណត់ Service / Pack
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            បន្ថែម service ថ្មី · រូប · តម្លៃ · បន្ទាប់មកដាក់ស្តុកខាងលើ
            {usingDefaults ? " · កំពុងប្រើ default" : ""}
          </p>
        </div>
        <div className="ad-head-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="ad-btn soft" onClick={addProduct}>
            + Service
          </button>
          <button type="button" className="ad-btn primary" disabled={saving} onClick={() => save(products)}>
            {saving ? "…" : (<><AIcon name="check" size={16} /> រក្សាទុក Service</>)}
          </button>
        </div>
      </div>

      {loading ? null : products.length === 0 ? (
        <p className="ad-empty">មិនទាន់មាន service — ចុច «+ Service»</p>
      ) : (
        products.map((p, i) => {
          const open = editIdx === i;
          const totalStock = (p.packs || []).reduce((s, pk) => s + (stockCounts[pk.id] || 0), 0);
          return (
            <article key={p.id || i} className={`ad-game${p.open !== false ? " on" : ""}`} style={{ marginBottom: 10, borderRadius: 12 }}>
              <div className="ad-game-top" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px" }}>
                {p.image ? (
                  <img src={p.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />
                ) : (
                  <span className="ad-tag" style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", fontWeight: 700 }}>
                    {(p.mark || "GC").slice(0, 2)}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <strong style={{ display: "block" }}>{p.name || p.id}</strong>
                  <small style={{ color: "var(--muted)" }}>
                    {(p.packs || []).length} packs · ស្តុក {totalStock}
                  </small>
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={p.open !== false} onChange={(e) => updateAt(i, { open: e.target.checked })} />
                  បង្ហាញ
                </label>
                <button type="button" className="ad-btn soft" onClick={() => setEditIdx(open ? -1 : i)}>
                  {open ? "បិទ" : "កែ"}
                </button>
                <button type="button" className="ad-btn danger" onClick={() => removeProduct(i)}>
                  លុប
                </button>
              </div>
              {open ? (
                <div className="ad-order-detail" style={{ padding: "12px 14px 16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>រូប</div>
                      <ImageSlot
                        src={p.image || ""}
                        fallback={(p.mark || "GC").slice(0, 2)}
                        size={72}
                        custom={!!p.image}
                        label="Upload"
                        onUrl={(url) => updateAt(i, { image: url })}
                        onClear={() => updateAt(i, { image: "" })}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", flex: 1, minWidth: 240 }}>
                      <label>
                        ID
                        <input value={p.id} onChange={(e) => updateAt(i, { id: e.target.value })} />
                      </label>
                      <label>
                        Mark
                        <input value={p.mark || ""} onChange={(e) => updateAt(i, { mark: e.target.value })} />
                      </label>
                      <label>
                        Name EN
                        <input value={p.name || ""} onChange={(e) => updateAt(i, { name: e.target.value })} />
                      </label>
                      <label>
                        Name KM
                        <input value={p.nameKm || ""} onChange={(e) => updateAt(i, { nameKm: e.target.value })} />
                      </label>
                    </div>
                  </div>
                  <h4 style={{ margin: "4px 0 10px" }}>Packs</h4>
                  {(p.packs || []).map((pk, j) => (
                    <div
                      key={pk.id || j}
                      style={{ display: "grid", gridTemplateColumns: "52px 1fr 1.4fr 0.7fr 0.7fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}
                    >
                      <ImageSlot
                        src={pk.image || ""}
                        fallback={(pk.name || "?").slice(0, 1)}
                        size={48}
                        custom={!!pk.image}
                        label="Pack"
                        onUrl={(url) => updatePack(i, j, { image: url })}
                        onClear={() => updatePack(i, j, { image: "" })}
                      />
                      <input placeholder="id" value={pk.id} onChange={(e) => updatePack(i, j, { id: e.target.value })} />
                      <input placeholder="name" value={pk.name} onChange={(e) => updatePack(i, j, { name: e.target.value, nameKm: e.target.value })} />
                      <input type="number" step="0.01" placeholder="price" value={pk.price} onChange={(e) => updatePack(i, j, { price: Number(e.target.value) })} />
                      <input type="number" step="0.01" placeholder="cost" value={pk.cost} onChange={(e) => updatePack(i, j, { cost: Number(e.target.value) })} />
                      <button type="button" className="ad-btn danger" onClick={() => removePack(i, j)}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className="ad-btn soft" onClick={() => addPack(i)}>
                    + Pack
                  </button>
                </div>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}


export default function ServicesAdmin() {
  const [games, setGames] = useState(null);
  const [sel, setSel] = useState({ markupPercent: 0, games: {} });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [raw, setRaw] = useState(null);

  // autosave bookkeeping
  const [rev, setRev] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const selRef = useRef(sel);
  selRef.current = sel;
  const revRef = useRef(0);

  const load = useCallback(() => {
    setErr("");
    setGames(null);
    api("/api/admin/kt-games")
      .then((d) => {
        setGames(d.games || []);
        setSel({ markupPercent: d.selection?.markupPercent || 0, games: d.selection?.games || {} });
        revRef.current = 0;
        setRev(0);
        setSavedRev(0);
      })
      .catch((e) => {
        setErr(e.message === "KHMER_TOPUP_API_KEY not set" ? "មិនទាន់កំណត់ KHMER_TOPUP_API_KEY ទេ" : e.message || "មិនអាចទាញបញ្ជីហ្គេមបានទេ");
        setGames([]);
      });
  }, []);

  useEffect(load, [load]);

  const save = useCallback(async () => {
    const myRev = revRef.current;
    setSaving(true);
    setSaveErr(false);
    try {
      await api("/api/admin/kt-selection", { method: "PUT", body: JSON.stringify(selRef.current) });
      setSavedRev(myRev);
    } catch {
      setSaveErr(true);
      toast("រក្សាទុកមិនបានទេ សូមព្យាយាមម្តងទៀត", "bad");
    } finally {
      setSaving(false);
    }
  }, []);

  // debounce: save 0.7s after the last change
  useEffect(() => {
    if (rev === savedRev || saveErr) return;
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
  }, [rev, savedRev, save, saveErr]);

  // warn before leaving with unsaved changes
  const unsaved = rev !== savedRev;
  useEffect(() => {
    if (!unsaved) return;
    const h = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  function touch() {
    revRef.current += 1;
    setRev(revRef.current);
    setSaveErr(false);
  }

  const patch = useCallback((slug, p) => {
    setSel((s) => ({ ...s, games: { ...s.games, [slug]: { ...blank, ...(s.games[slug] || {}), ...p } } }));
    revRef.current += 1;
    setRev(revRef.current);
    setSaveErr(false);
  }, []);

  async function showRaw() {
    try {
      const d = await api("/api/admin/kt-games?raw=1");
      setRaw(JSON.stringify((d.raw || []).slice(0, 1), null, 2));
    } catch (e) {
      setRaw(String(e.message));
    }
  }

  const enabledCount = Object.values(sel.games).filter((g) => g.enabled).length;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (games || []).filter((g) => {
      const on = !!sel.games[g.slug]?.enabled;
      if (filter === "on" && !on) return false;
      if (filter === "off" && on) return false;
      return !s || g.name.toLowerCase().includes(s) || g.slug.toLowerCase().includes(s);
    });
  }, [games, q, filter, sel.games]);

  const stateLabel = saveErr ? (
    <button type="button" className="ad-save err" onClick={save}>
      <AIcon name="alert" size={14} /> រក្សាទុកមិនបាន — ចុចសាកម្តងទៀត
    </button>
  ) : saving ? (
    <span className="ad-save"><span className="ad-spin" /> កំពុងរក្សាទុក…</span>
  ) : unsaved ? (
    <span className="ad-save wait">មានការផ្លាស់ប្តូរ…</span>
  ) : (
    <span className="ad-save ok"><AIcon name="check" size={14} /> បានរក្សាទុករួច</span>
  );

  return (
    <div>
      <LocalServicesPanel />
      <PageHead km="សេវាហ្គេម" en="Choose which Khmer TopUp games to sell · upload images">
        {stateLabel}
      </PageHead>

      {err ? <p className="ad-error">{err}</p> : null}

      <section className="ad-card ad-toolbar">
        <div className="ad-search grow">
          <AIcon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ស្វែងរកឈ្មោះហ្គេម…" />
        </div>
        <label className="ad-inline big">
          បូកថែមទូទៅ %
          <input
            type="number"
            min="0"
            step="0.5"
            value={sel.markupPercent}
            onChange={(e) => {
              setSel((s) => ({ ...s, markupPercent: e.target.value }));
              touch();
            }}
          />
        </label>
      </section>

      <div className="ad-chips">
        {[
          ["all", `ទាំងអស់`, games?.length || 0],
          ["on", "កំពុងលក់", enabledCount],
          ["off", "មិនលក់", Math.max(0, (games?.length || 0) - enabledCount)],
        ].map(([k, label, n]) => (
          <button key={k} type="button" className={`ad-chip${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>
            {label} <em>{n}</em>
          </button>
        ))}
        <span className="grow" />
        <button type="button" className="ad-btn soft sm" onClick={load}>
          <AIcon name="refresh" size={14} /> ទាញពី Khmer TopUp
        </button>
        <button type="button" className="ad-btn soft sm" onClick={showRaw}>
          Raw API
        </button>
      </div>

      {raw ? <pre className="ad-raw">{raw}</pre> : null}

      {!games ? (
        <div className="ad-loading"><span className="ad-spin" /> កំពុងទាញបញ្ជីហ្គេម…</div>
      ) : null}
      {games && !err && games.length === 0 ? (
        <p className="ad-empty card">Khmer TopUp មិនបានផ្តល់ហ្គេមទេ (ឬទម្រង់ទិន្នន័យមិនស្គាល់ — សាកមើល «Raw API»)</p>
      ) : null}
      {games && games.length > 0 && list.length === 0 ? <p className="ad-empty card">រកមិនឃើញហ្គេមទេ</p> : null}

      <div className="ad-games">
        {list.map((g) => (
          <GameCard
            key={g.slug}
            g={g}
            s={{ ...blank, ...(sel.games[g.slug] || {}) }}
            defaultMarkup={sel.markupPercent}
            isOpen={open === g.slug}
            onToggleOpen={() => setOpen(open === g.slug ? "" : g.slug)}
            patch={patch}
          />
        ))}
      </div>
    </div>
  );
}
