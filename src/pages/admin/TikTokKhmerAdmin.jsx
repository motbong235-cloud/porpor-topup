import { useCallback, useEffect, useState } from "react";
import { AIcon, ImageSlot, PageHead, Switch, api, toast, usd } from "./ui";

const TID = "tiktok-khmer";

function blankPack() {
  return {
    id: `ttk-${Date.now().toString(36)}`,
    name: "",
    nameKm: "",
    price: 0.99,
    cost: 0.5,
    category: "TikTok Like",
    bonus: "",
    image: "",
  };
}

export default function TikTokKhmerAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [all, setAll] = useState([]);
  const [product, setProduct] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/admin/local-products");
      const list = Array.isArray(data.products) ? data.products : [];
      setAll(list);
      let p = list.find((x) => String(x.id) === TID);
      if (!p) {
        p = {
          id: TID,
          name: "TikTok Khmer",
          nameKm: "TikTok Khmer",
          region: "Cambodia",
          blurbKm: "សេវា TikTok Khmer — បង់លើ website · order ចូល bot Kai-",
          blurbEn: "TikTok Khmer — pay on site · order notifies Kai- bot",
          famous: true,
          hot: true,
          open: true,
          showWhenOff: false,
          hue: 340,
          mark: "TT",
          image: "/icons/tiktok.svg",
          banners: [],
          banner: "",
          deliveryType: "live_chat",
          requireUsername: true,
          idHintKm: "បញ្ចូល Link TikTok (https://…) ឬ @username",
          idHintEn: "Enter TikTok link (https://…) or @username",
          packs: [
            { id: "ttk-500-1k", name: "500-1K Like + 1.8K Views", nameKm: "500-1K Like + 1.8K Views", price: 0.99, cost: 0.5, category: "TikTok Like", bonus: "" },
            { id: "ttk-1k-2k", name: "1K-2K Like + 3K Views", nameKm: "1K-2K Like + 3K Views", price: 1.79, cost: 0.9, category: "TikTok Like", bonus: "" },
          ],
        };
      }
      setProduct({ ...p, packs: Array.isArray(p.packs) ? p.packs : [] });
    } catch (e) {
      toast(e.message || "Load failed", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(field, value) {
    setProduct((p) => (p ? { ...p, [field]: value } : p));
  }

  function patchPack(i, field, value) {
    setProduct((p) => {
      if (!p) return p;
      const packs = p.packs.map((x, j) => (j === i ? { ...x, [field]: value } : x));
      return { ...p, packs };
    });
  }

  function addPack() {
    setProduct((p) => (p ? { ...p, packs: [...(p.packs || []), blankPack()] } : p));
  }

  function removePack(i) {
    setProduct((p) => (p ? { ...p, packs: p.packs.filter((_, j) => j !== i) } : p));
  }

  async function save() {
    if (!product) return;
    setSaving(true);
    try {
      const rest = all.filter((x) => String(x.id) !== TID);
      const next = [...rest, product];
      const data = await api("/api/admin/local-products", {
        method: "PUT",
        body: JSON.stringify({ products: next }),
      });
      setAll(data.products || next);
      const p = (data.products || next).find((x) => String(x.id) === TID);
      if (p) setProduct(p);
      toast("រក្សាទុក TikTok Khmer រួច", "ok");
    } catch (e) {
      toast(e.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !product) {
    return (
      <div className="ad-page">
        <PageHead title="TikTok Khmer" sub="Loading…" />
        <div className="ad-spin big" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <PageHead
        title="TikTok Khmer"
        sub="Products · កញ្ចប់ · បង្ហាញ Home · order → bot Kai-"
        actions={
          <button type="button" className="ad-btn primary" disabled={saving} onClick={save}>
            {saving ? "…" : "រក្សាទុក"}
          </button>
        }
      />

      <section className="ad-card">
        <div className="ad-grid-2" style={{ alignItems: "start" }}>
          <div>
            <label className="ad-field">
              <span>ឈ្មោះ (EN)</span>
              <input value={product.name || ""} onChange={(e) => patch("name", e.target.value)} />
            </label>
            <label className="ad-field">
              <span>ឈ្មោះ (ខ្មែរ)</span>
              <input value={product.nameKm || ""} onChange={(e) => patch("nameKm", e.target.value)} />
            </label>
            <label className="ad-field">
              <span>Blurb ខ្មែរ</span>
              <input value={product.blurbKm || ""} onChange={(e) => patch("blurbKm", e.target.value)} />
            </label>
            <label className="ad-field">
              <span>Hint (link)</span>
              <input value={product.idHintKm || ""} onChange={(e) => patch("idHintKm", e.target.value)} />
            </label>
          </div>
          <div>
            <ImageSlot
              src={product.image || ""}
              label="រូប product (Home)"
              onUrl={(u) => patch("image", u)}
              onClear={() => patch("image", "")}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              <label className="ad-switch-row">
                <Switch checked={product.open !== false} onChange={(v) => patch("open", v)} />
                <span>បើកលក់</span>
              </label>
              <label className="ad-switch-row">
                <Switch checked={!!product.famous} onChange={(v) => patch("famous", v)} />
                <span>Famous (Home)</span>
              </label>
              <label className="ad-switch-row">
                <Switch checked={!!product.hot} onChange={(v) => patch("hot", v)} />
                <span>Hot</span>
              </label>
              <label className="ad-switch-row">
                <Switch checked={!!product.requireUsername} onChange={(v) => patch("requireUsername", v)} />
                <span>ត្រូវ Link / Username</span>
              </label>
            </div>
            <p className="ad-hint" style={{ marginTop: 10 }}>
              Delivery: <b>Live Chat</b> · បង់ QR លើ website · សារចូល <b>bot Kai-</b>
            </p>
          </div>
        </div>
      </section>

      <section className="ad-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>កញ្ចប់ ({product.packs?.length || 0})</h2>
          <button type="button" className="ad-btn soft" onClick={addPack}>
            + បន្ថែមកញ្ចប់
          </button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {(product.packs || []).map((pk, i) => (
            <div
              key={pk.id || i}
              style={{
                border: "1px solid var(--ad-line, #e2e8f0)",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr 100px 100px auto",
              }}
              className="ad-ttk-pack-row"
            >
              <label className="ad-field" style={{ margin: 0 }}>
                <span>ឈ្មោះ</span>
                <input value={pk.name || ""} onChange={(e) => patchPack(i, "name", e.target.value)} />
              </label>
              <label className="ad-field" style={{ margin: 0 }}>
                <span>Category</span>
                <input
                  value={pk.category || ""}
                  onChange={(e) => patchPack(i, "category", e.target.value)}
                  placeholder="TikTok Like"
                />
              </label>
              <label className="ad-field" style={{ margin: 0 }}>
                <span>តម្លៃ $</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pk.price ?? ""}
                  onChange={(e) => patchPack(i, "price", Number(e.target.value))}
                />
              </label>
              <label className="ad-field" style={{ margin: 0 }}>
                <span>Cost $</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pk.cost ?? ""}
                  onChange={(e) => patchPack(i, "cost", Number(e.target.value))}
                />
              </label>
              <button type="button" className="ad-btn soft" onClick={() => removePack(i)} title="លុប">
                <AIcon name="trash" />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="ad-btn primary" disabled={saving} onClick={save}>
            {saving ? "…" : "រក្សាទុក"}
          </button>
        </div>
      </section>
    </div>
  );
}
