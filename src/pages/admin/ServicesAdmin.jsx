import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AIcon, ImageSlot, PageHead, Switch, WideImageSlot, api, toast, usd } from "./ui";

const blank = { enabled: false, showWhenOff: false, featured: false, markup: null, packages: null, image: "", banner: "", banners: [], packIcon: "", packImages: {} };

function sellPrice(cost, markup) {
  return Math.ceil(cost * (1 + (Number(markup) || 0) / 100) * 100 - 1e-9) / 100;
}

function markOf(name) {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}


const MAX_BANNERS = 5;

/** 1–5 banners per service. Empty slot at the end adds another (until 5). */
function BannerManager({ banners, legacy, onChange }) {
  const list = banners && banners.length ? banners : legacy ? [legacy] : [];
  const set = (next) => onChange(next.slice(0, MAX_BANNERS));
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  }
  return (
    <div className="ad-banner-set">
      <div className="ad-banner-label">
        <strong>🖼 Banner សម្រាប់ service នេះ ({list.length}/{MAX_BANNERS})</strong>
        <small>
          Service ១ = Banner ផ្ទាល់ខ្លួន (មិនចែកជាមួយ service ផ្សេង) ·
          បង្ហាញនៅកន្លែង logo ខាងលើទំព័រ service · 1600×500 · 1–5 រូប
        </small>
      </div>
      <div className="ad-banner-list">
        {list.map((url, i) => (
          <div key={i} className="ad-banner-item">
            <WideImageSlot
              src={url}
              ratio="16 / 5"
              maxWidth={1600}
              label={`Banner ${i + 1}`}
              onUrl={(u) => set(list.map((x, k) => (k === i ? u : x)))}
              onClear={() => set(list.filter((_, k) => k !== i))}
            />
            {list.length > 1 ? (
              <div className="ad-banner-move">
                <span>#{i + 1}</span>
                <button type="button" className="ad-btn soft sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="ឡើងលើ">↑</button>
                <button type="button" className="ad-btn soft sm" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="ចុះក្រោម">↓</button>
              </div>
            ) : null}
          </div>
        ))}
        {list.length < MAX_BANNERS ? (
          <div className="ad-banner-item">
            <WideImageSlot
              src=""
              ratio="16 / 5"
              maxWidth={1600}
              label={list.length ? "+ បន្ថែម banner service នេះ" : "Upload Banner (service នេះតែម្តង)"}
              hint={list.length ? `នៅសល់ ${MAX_BANNERS - list.length}` : "1600 × 500 px"}
              onUrl={(u) => set([...list, u])}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
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
            {(s.banners?.length || s.banner) ? <span className="ad-tag ok">Banner {s.banners?.length || 1}</span> : null}
            {s.enabled ? (
              <span className="ad-tag ok">កំពុងលក់ · {chosen.size} កញ្ចប់</span>
            ) : s.showWhenOff ? (
              <span className="ad-tag">បង្ហាញជា OFF</span>
            ) : (
              <span className="ad-tag">លាក់ពី website</span>
            )}
          </div>
        </div>
        <div className="ad-game-sw">
          <Switch checked={s.enabled} onChange={(v) => patch(g.slug, { enabled: v })} label={`លក់ ${g.name}`} />
          <small>{s.enabled ? "បើក" : "បិទ"}</small>
        </div>
      </div>

      <BannerManager
        banners={s.banners}
        legacy={s.banner}
        onChange={(list) => patch(g.slug, { banners: list, banner: list[0] || "" })}
      />

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
        {!s.enabled ? (
          <label className="ad-check" title="ពេលបិទលក់ ហ្គេមនេះលាក់ពី website។ ធីកនេះដើម្បីបង្ហាញវាជា OFF/ថែទាំ">
            <input
              type="checkbox"
              checked={!!s.showWhenOff}
              onChange={(e) => patch(g.slug, { showWhenOff: e.target.checked })}
            />
            បង្ហាញជា OFF
          </label>
        ) : null}
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

/* ─── Local services (Roblox / manual delivery) ─── */
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
    image: "",
    banner: "",
    banners: [],
    deliveryType: "gift_code",
    idHintKm: "",
    idHintEn: "",
    packs: [{ id: "", name: "", price: 0, cost: 0, category: "Roblox" }],
  };
}




function LocalServicesPanel() {
  const [products, setProducts] = useState([]);
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState(0);
  const [stockCounts, setStockCounts] = useState({});
  const [stockDraft, setStockDraft] = useState({});
  const [stockBusy, setStockBusy] = useState("");
  const [stockOk, setStockOk] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/admin/local-products");
      setProducts(Array.isArray(d.products) ? d.products : []);
      setUsingDefaults(!!d.usingDefaults);
      let counts = d.stockCounts || {};
      try {
        const st = await api("/api/admin/gift-stock");
        counts = st.counts || counts;
        setStockOk(true);
      } catch {
        setStockOk(false);
      }
      setStockCounts(counts);
    } catch {
      setProducts([]);
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
      await load();
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
      setStockOk(true);
      toast(mode === "append" ? `បន្ថែមស្តុក · សរុប ${d.count}` : `ស្តុកថ្មី · ${d.count} កូដ`);
      if (mode !== "append") setStockDraft((s) => ({ ...s, [packId]: "" }));
    } catch {
      setStockOk(false);
      toast("Stock API មិនដំណើរការ — deploy server/index.js + store.js", "bad");
    } finally {
      setStockBusy("");
    }
  }

  function addProduct(type) {
    const id = `svc-${Date.now().toString(36)}`;
    const isChat = type === "live_chat";
    const p = {
      id,
      name: isChat ? "Live Chat Service" : "Stock Gift Service",
      nameKm: isChat ? "សេវា Live Chat" : "សេវាស្តុកកូដ",
      region: "Cambodia",
      blurbKm: isChat ? "បង់រួចទាក់ទង Live Chat / Telegram" : "បង់រួចទទួលកូដស្វ័យប្រវត្តិ",
      blurbEn: isChat ? "Pay then contact Live Chat" : "Pay then get code from stock",
      famous: true,
      hot: true,
      open: true,
      hue: isChat ? 280 : 210,
      mark: isChat ? "LC" : "ST",
      image: "",
      deliveryType: isChat ? "live_chat" : (p.deliveryType === "robux_send" ? "robux_send" : "stock"),
      requireUsername: isChat ? true : false,
      packs: [{ id: `${id}-1`, name: "Pack 1", nameKm: "Pack 1", price: 1, cost: 1, category: "Roblox", image: "" }],
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
          packs: [...(p.packs || []), { id: `${p.id}-${n}`, name: `Pack ${n}`, nameKm: `Pack ${n}`, price: 1, cost: 1, category: "Roblox", image: "" }],
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

  const stockPacks = [];
  products.forEach((p) => {
    const dt = p.deliveryType === "gift_code" ? "stock" : p.deliveryType;
    if (dt !== "stock") return;
    (p.packs || []).forEach((pk) => stockPacks.push({ service: p.name || p.id, pack: pk }));
  });

  return (
    <section className="ad-local">
      <header className="ad-local-head">
        <div className="ad-local-head-text">
          <h1>
            <AIcon name="box" size={20} /> សេវា Local
          </h1>
          <p>
            <b>ស្តុក</b> = កូដ auto · <b>Live Chat</b> = ឆាត Admin បន្ទាប់ពីបង់
          </p>
        </div>
        <div className="ad-local-actions">
          <button type="button" className="ad-btn soft" onClick={load} disabled={loading}>
            <AIcon name="refresh" size={16} /> ផ្ទុក
          </button>
          <button type="button" className="ad-btn soft" onClick={() => addProduct("stock")}>
            + ស្តុក
          </button>
          <button type="button" className="ad-btn soft" onClick={() => addProduct("live_chat")}>
            + Live Chat
          </button>
          <button type="button" className="ad-btn primary" disabled={saving} onClick={() => save(products)}>
            {saving ? "…" : (<><AIcon name="check" size={16} /> រក្សាទុក</>)}
          </button>
        </div>
      </header>

      <div className="ad-local-body">
        {/* Stock zone */}
        <div className="ad-stock-zone">
          <div className="ad-section-title">
            <AIcon name="box" size={18} />
            <strong>ដាក់ស្តុកកូដ</strong>
            <span className="ad-muted">សម្រាប់ service ប្រភេទស្តុក</span>
          </div>

          {!stockOk ? (
            <div className="ad-banner warn">
              <AIcon name="alert" size={16} />
              <span>Stock API មិនទាន់ដំណើរការ — deploy <code>server/index.js</code> + <code>server/store.js</code></span>
            </div>
          ) : null}

          {loading ? (
            <div className="ad-loading"><span className="ad-spin" /> កំពុងផ្ទុក…</div>
          ) : stockPacks.length === 0 ? (
            <p className="ad-muted">មិនទាន់មាន pack ស្តុក — ចុច <b>+ ស្តុក</b> ខាងលើ</p>
          ) : (
            <div className="ad-stock-list">
              {stockPacks.map(({ service, pack: pk }) => (
                <div key={pk.id} className="ad-stock-card">
                  <div className="ad-stock-card-top">
                    <div>
                      <strong>{service}</strong>
                      <span className="ad-muted"> · {pk.name || pk.id}</span>
                      <div className="ad-mono-sm">
                        <code>{pk.id}</code> · ${Number(pk.price || 0).toFixed(2)}
                      </div>
                    </div>
                    <span className={`ad-tag${(stockCounts[pk.id] || 0) > 0 ? " ok" : ""}`}>
                      នៅសល់ {stockCounts[pk.id] || 0}
                    </span>
                  </div>
                  <textarea
                    className="ad-stock-ta"
                    rows={3}
                    placeholder={"CODE-001\nCODE-002\nCODE-003"}
                    value={stockDraft[pk.id] ?? ""}
                    onChange={(e) => setStockDraft((s) => ({ ...s, [pk.id]: e.target.value }))}
                  />
                  <div className="ad-row-btns">
                    <button
                      type="button"
                      className="ad-btn primary"
                      disabled={stockBusy === pk.id}
                      onClick={() => saveStock(pk.id, "append")}
                    >
                      <AIcon name="box" size={15} /> បន្ថែមស្តុក
                    </button>
                    <button
                      type="button"
                      className="ad-btn soft"
                      disabled={stockBusy === pk.id}
                      onClick={() => confirm("ជំនួសស្តុកទាំងអស់?") && saveStock(pk.id, "replace")}
                    >
                      ជំនួស
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service list */}
        <div className="ad-svc-list">
          <div className="ad-section-title">
            <strong>បញ្ជី Service</strong>
          </div>

          {loading ? null : products.length === 0 ? (
            <p className="ad-empty">មិនទាន់មាន — ចុច + ស្តុក ឬ + Live Chat</p>
          ) : (
            products.map((p, i) => {
              const open = editIdx === i;
              let dt = p.deliveryType || "stock";
              if (dt === "gift_code") dt = "stock";
              const isStock = dt === "stock";
              const needUser =
                typeof p.requireUsername === "boolean"
                  ? p.requireUsername
                  : dt === "live_chat";
              const totalStock = (p.packs || []).reduce((s, pk) => s + (stockCounts[pk.id] || 0), 0);
              return (
                <article key={p.id || i} className={`ad-svc-item${p.open !== false ? " on" : ""}`}>
                  <div className="ad-svc-row">
                    {p.image ? (
                      <img src={p.image} alt="" className="ad-svc-thumb" />
                    ) : (
                      <span className="ad-svc-mark">{(p.mark || "GC").slice(0, 2)}</span>
                    )}
                    <div className="ad-svc-info">
                      <strong>{p.name || p.id}</strong>
                      <small>
                        {(p.packs || []).length} packs
                        {isStock ? ` · ស្តុក ${totalStock}` : " · Live Chat"}
                        {needUser ? " · Username" : ""}
                        {(p.banners?.length || p.banner) ? ` · Banner ${p.banners?.length || 1}` : ""}
                      </small>
                    </div>
                    <span className={`ad-tag${isStock ? " ok" : ""}`}>{isStock ? "ស្តុក" : "Live Chat"}</span>
                    <button
                      type="button"
                      className={`ad-btn${needUser ? " primary" : " soft"} sm`}
                      onClick={async () => {
                        const next = products.map((x, idx) =>
                          idx === i ? { ...x, requireUsername: !needUser } : x,
                        );
                        setProducts(next);
                        await save(next);
                      }}
                    >
                      <AIcon name={needUser ? "check" : "x"} size={13} /> User
                    </button>
                    <label className="ad-check">
                      <input
                        type="checkbox"
                        checked={p.open !== false}
                        onChange={(e) => updateAt(i, { open: e.target.checked })}
                      />
                      បើកលក់
                    </label>
                    {p.open === false ? (
                      <label className="ad-check" title="ពេលបិទ វាលាក់ពី website។ ធីកនេះដើម្បីបង្ហាញជា OFF">
                        <input
                          type="checkbox"
                          checked={!!p.showWhenOff}
                          onChange={(e) => updateAt(i, { showWhenOff: e.target.checked })}
                        />
                        បង្ហាញជា OFF
                      </label>
                    ) : null}
                    <button type="button" className={`ad-btn${(p.banners?.length || p.banner) ? " primary" : " soft"} sm`} onClick={() => setEditIdx(i)} title="កំណត់ banner">
                      <AIcon name="upload" size={13} /> Banner
                    </button>
                    <button type="button" className="ad-btn soft sm" onClick={() => setEditIdx(open ? -1 : i)}>
                      {open ? "បិទ" : "កែ"}
                    </button>
                    <button type="button" className="ad-btn danger sm" onClick={() => removeProduct(i)}>
                      លុប
                    </button>
                  </div>

                  {open ? (
                    <div className="ad-svc-edit">
                      <div className="ad-svc-edit-top">
                        <ImageSlot
                          src={p.image || ""}
                          fallback={(p.mark || "GC").slice(0, 2)}
                          size={64}
                          custom={!!p.image}
                          label="រូប"
                          onUrl={(url) => updateAt(i, { image: url })}
                          onClear={() => updateAt(i, { image: "" })}
                        />
                        <div className="ad-form-grid">
                          <label>
                            ID
                            <input value={p.id} onChange={(e) => updateAt(i, { id: e.target.value })} />
                          </label>
                          <label>
                            Name EN
                            <input value={p.name || ""} onChange={(e) => updateAt(i, { name: e.target.value })} />
                          </label>
                          <label>
                            Name KM
                            <input value={p.nameKm || ""} onChange={(e) => updateAt(i, { nameKm: e.target.value })} />
                          </label>
                          <label className="span-2">
                            ការពិពណ៌នា
                            <input
                              value={p.blurbKm || ""}
                              onChange={(e) => updateAt(i, { blurbKm: e.target.value, blurbEn: e.target.value })}
                            />
                          </label>
                          {(p.deliveryType === "live_chat" || (!p.deliveryType && needUser)) ? (
                            <label className="span-2">
                              Note លើទំព័រ (Live Chat / ដោយដៃ) — អាចកែបាន
                              <textarea
                                rows={3}
                                value={p.idHintKm || ""}
                                placeholder="យើងខ្ញុំមិនទាមទារ Password… បង់រួចទទួល Order ID រួចផ្ញើតាម Live Chat…"
                                onChange={(e) =>
                                  updateAt(i, { idHintKm: e.target.value, idHintEn: e.target.value })
                                }
                              />
                            </label>
                          ) : null}

                          {(p.deliveryType === "live_chat") ? (
                            <div className="ad-safety-box span-2">
                              <label className="ad-check-row">
                                <input
                                  type="checkbox"
                                  checked={!!(p.safetyGuide && p.safetyGuide.enabled)}
                                  onChange={(e) =>
                                    updateAt(i, {
                                      safetyGuide: {
                                        ...(p.safetyGuide || {}),
                                        enabled: e.target.checked,
                                        titleKm: (p.safetyGuide && p.safetyGuide.titleKm) || "សូមអានមុនបន្ត",
                                        titleEn: (p.safetyGuide && p.safetyGuide.titleEn) || "Please read before continuing",
                                        stepsKm:
                                          (p.safetyGuide && p.safetyGuide.stepsKm) || [
                                            "បើក Settings ក្នុង Roblox → បិទ Select / Unselect និង Kid",
                                            "កុំផ្តល់ Password — Admin មិនសុំ Password",
                                            "បង់រួចផ្ញើ Order ID តាម Live Chat",
                                          ],
                                        stepsEn:
                                          (p.safetyGuide && p.safetyGuide.stepsEn) || [
                                            "Open Roblox Settings → turn off Select / Unselect and Kid",
                                            "Never share your password — Admin never asks for it",
                                            "After payment, send Order ID via Live Chat",
                                          ],
                                      },
                                    })
                                  }
                                />
                                <span>បង្ហាញ Popup ការណែនាំពេលចូល service (ដោយដៃ)</span>
                              </label>
                              {p.safetyGuide?.enabled ? (
                                <>
                                  <label>
                                    ចំណងជើង Popup
                                    <input
                                      value={p.safetyGuide?.titleKm || ""}
                                      onChange={(e) =>
                                        updateAt(i, {
                                          safetyGuide: {
                                            ...p.safetyGuide,
                                            titleKm: e.target.value,
                                            titleEn: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    ជំហាន (១ បន្ទាត់ = ១ ជំហាន)
                                    <textarea
                                      rows={4}
                                      value={(p.safetyGuide?.stepsKm || []).join("\n")}
                                      onChange={(e) => {
                                        const steps = e.target.value
                                          .split("\n")
                                          .map((x) => x.trim())
                                          .filter(Boolean)
                                          .slice(0, 6);
                                        updateAt(i, {
                                          safetyGuide: {
                                            ...p.safetyGuide,
                                            stepsKm: steps,
                                            stepsEn: steps,
                                          },
                                        });
                                      }}
                                    />
                                  </label>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <BannerManager
                        banners={p.banners}
                        legacy={p.banner}
                        onChange={(list) => {
                          setProducts((prev) => {
                            const next = prev.map((p, idx) =>
                              idx === i ? { ...p, banners: list, banner: list[0] || "" } : p
                            );
                            // autosave banner so service keeps its own image
                            setTimeout(() => save(next), 400);
                            return next;
                          });
                        }}
                      />

                      <div className="ad-mode-label">របៀបដំណើរការ</div>
                      <div className="ad-mode-grid">
                        {[
                          { dt: "stock", user: false, label: "ស្តុក", sub: "កូដ auto · គ្មាន username" },
                          { dt: "stock", user: true, label: "ស្តុក + User", sub: "កូដ auto · មាន form" },
                          { dt: "live_chat", user: false, label: "Live Chat", sub: "ឆាត Admin · គ្មាន username" },
                          { dt: "live_chat", user: true, label: "Live Chat + User", sub: "ឆាត Admin · មាន form" },
                        ].map((m) => {
                          const on = dt === m.dt && !!needUser === m.user;
                          return (
                            <button
                              key={m.dt + String(m.user)}
                              type="button"
                              className={`ad-mode${on ? " on" : ""}`}
                              onClick={() =>
                                updateAt(i, {
                                  deliveryType: m.dt,
                                  requireUsername: m.user,
                                  mark: m.dt === "live_chat" ? "LC" : "ST",
                                })
                              }
                            >
                              <strong>{m.label}</strong>
                              <span>{m.sub}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="ad-mode-label">Packs</div>
                      {(p.packs || []).map((pk, j) => (
                        <div key={pk.id || j} className="ad-pack-row">
                          <ImageSlot
                            src={pk.image || ""}
                            fallback={(pk.name || "?").slice(0, 1)}
                            size={40}
                            custom={!!pk.image}
                            label=""
                            onUrl={(url) => updatePack(i, j, { image: url })}
                            onClear={() => updatePack(i, j, { image: "" })}
                          />
                          <input placeholder="id" value={pk.id} onChange={(e) => updatePack(i, j, { id: e.target.value })} />
                          <input
                            placeholder="name"
                            value={pk.name}
                            onChange={(e) => updatePack(i, j, { name: e.target.value, nameKm: e.target.value })}
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="$"
                            value={pk.price}
                            onChange={(e) => updatePack(i, j, { price: Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="cost"
                            value={pk.cost}
                            onChange={(e) => updatePack(i, j, { cost: Number(e.target.value) })}
                          />
                          <button type="button" className="ad-btn danger sm" onClick={() => removePack(i, j)}>
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="ad-btn soft sm" onClick={() => addPack(i)}>
                        + Pack
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}


export default function ServicesAdmin() {
  const [tab, setTab] = useState("local"); // local | topup
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
      <PageHead km="សេវាកម្ម" en="Local stock / Live Chat · Khmer TopUp games" />

      <div className="ad-seg" role="tablist">
        <button type="button" role="tab" className={tab === "local" ? "on" : ""} onClick={() => setTab("local")}>
          ស្តុក / Live Chat
        </button>
        <button type="button" role="tab" className={tab === "topup" ? "on" : ""} onClick={() => setTab("topup")}>
          Auto TopUp (Khmer)
        </button>
      </div>

      {tab === "local" ? <LocalServicesPanel /> : null}

      {tab === "topup" ? (
      <>
      <PageHead km="សេវាហ្គេម Auto" en="Choose which Khmer TopUp games to sell · upload images">
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
      </>
      ) : null}
    </div>
  );
}
