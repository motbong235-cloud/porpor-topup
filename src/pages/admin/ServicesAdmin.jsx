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
