import { useCallback, useEffect, useState } from "react";
import { AIcon, BannerManager, ImageSlot, PageHead, Switch, VideoSlot, api, toast } from "./ui";

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
            { id: "ttk-01", name: "500-1K Likes | 1.8K Views", nameKm: "500-1K Likes | 1.8K Views", price: 0.99, cost: 0.5, category: "TikTok Like", bonus: "" },
            { id: "ttk-02", name: "1K-2K Likes | 3.5K Views", nameKm: "1K-2K Likes | 3.5K Views", price: 1.99, cost: 1.0, category: "TikTok Like", bonus: "" },
            { id: "ttk-03", name: "2K-3K Likes | 10K Views", nameKm: "2K-3K Likes | 10K Views", price: 3.25, cost: 1.6, category: "TikTok Like", bonus: "" },
            { id: "ttk-04", name: "3K-5K Likes | 20K Views", nameKm: "3K-5K Likes | 20K Views", price: 5.49, cost: 2.7, category: "TikTok Like", bonus: "" },
            { id: "ttk-05", name: "2K-5K Views", nameKm: "2K-5K Views", price: 0.99, cost: 0.5, category: "TikTok Views", bonus: "" },
            { id: "ttk-06", name: "100-200 Followers", nameKm: "100-200 Followers", price: 0.99, cost: 0.5, category: "TikTok Followers", bonus: "" },
          ],
        };
      }
      setProduct({ ...p, packs: Array.isArray(p.packs) ? p.packs : [] });
    } catch (e) {
      toast(e.message || "Load failed", "bad");
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
      toast(e.message || "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !product) {
    return (
      <div className="ad-page">
        <PageHead km="TikTok Khmer" en="Loading…" />
        <div className="ad-spin big" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <PageHead km="TikTok Khmer" en="Products · កញ្ចប់ · បង្ហាញ Home · order → bot Kai-">
        <button type="button" className="ad-btn primary" disabled={saving} onClick={save}>
          {saving ? "…" : "រក្សាទុក"}
        </button>
      </PageHead>

      {/* Service banner is intentionally first so it is easy to find in admin. */}
      <section className="ad-card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AIcon name="image" size={18} /> ① Banner ខាងលើសេវា TikTok Khmer
        </h2>
        <p className="ad-hint">Upload រូប Banner ដែលនឹងបង្ហាញនៅផ្នែកខាងលើទំព័រ TikTok Khmer មុនព័ត៌មានសេវា និងកញ្ចប់។ អាចដាក់បាន 1–5 រូប (ណែនាំ 1600 × 500 px)។
        </p>
        <BannerManager
          banners={product.banners}
          legacy={product.banner}
          onChange={(list) => setProduct((p) => (p ? { ...p, banners: list, banner: list[0] || "" } : p))}
        />
      </section>

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
        <h2 style={{ margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><AIcon name="video" size={18} /> ② Tutorial Video (បង់រួចបង្ហាញ)</h2>
        <p className="ad-hint">Upload video ពី phone / កុំព្យូទ័រ · បង្ហាញលើទំព័រ Success បន្ទាប់ពីអតិថិជនបង់ប្រាក់</p>
        <VideoSlot
          src={product.tutorialVideoUrl || ""}
          onUrl={(u) => patch("tutorialVideoUrl", u)}
          onClear={() => patch("tutorialVideoUrl", "")}
        />
        <label className="ad-field" style={{ marginTop: 14 }}>
          <span>Video Title</span>
          <input
            value={product.tutorialVideoTitle || ""}
            onChange={(e) => patch("tutorialVideoTitle", e.target.value)}
            placeholder="Tutorial · របៀបប្រើ"
          />
        </label>
        <details className="ad-vslot-alt">
          <summary>ឬប្រើ Link (YouTube / https://…)</summary>
          <label className="ad-field">
            <span>Video URL</span>
            <input
              value={product.tutorialVideoUrl || ""}
              onChange={(e) => patch("tutorialVideoUrl", e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </label>
        </details>
      </section>

      <section className="ad-card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><AIcon name="note" size={18} /> ③ Customer Note / Message Template</h2>
        <label className="ad-field">
          <span>Note (ខ្មែរ)</span>
          <textarea
            rows={5}
            maxLength={1000}
            value={product.customerNoteKm || ""}
            onChange={(e) => patch("customerNoteKm", e.target.value)}
            style={{ width: "100%", borderRadius: 10, padding: 10 }}
          />
        </label>
        <label className="ad-field">
          <span>Note (English)</span>
          <textarea
            rows={5}
            maxLength={1000}
            value={product.customerNoteEn || ""}
            onChange={(e) => patch("customerNoteEn", e.target.value)}
            style={{ width: "100%", borderRadius: 10, padding: 10 }}
          />
        </label>
      </section>

      <section className="ad-card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><AIcon name="support" size={18} /> ④ Support Contact</h2>
        <label className="ad-field">
          <span>Telegram Support</span>
          <input
            value={product.supportContact || "https://t.me/kairozen_support"}
            onChange={(e) => patch("supportContact", e.target.value)}
            placeholder="https://t.me/kairozen_support"
          />
        </label>
        <p className="ad-hint">លំនាំដើម: @kairozen_support</p>
      </section>

      <section className="ad-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><AIcon name="box" size={18} /> កញ្ចប់ ({product.packs?.length || 0})</h2>
          <button type="button" className="ad-btn soft" onClick={addPack}>
            <AIcon name="plus" size={15} /> បន្ថែមកញ្ចប់
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
