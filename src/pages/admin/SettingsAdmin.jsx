import { useEffect, useState } from "react";
import { AIcon, PageHead, Switch, api, toast } from "./ui";

const emptyCoupon = { code: "", type: "percent", value: 10, min: 0 };

function Field({ label, children, hint }) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function SettingsAdmin() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api("/api/admin/settings")
      .then((s) => setForm({ ...s, coupons: Array.isArray(s.coupons) ? s.coupons : [] }))
      .catch(() => toast("មិនអាចទាញការកំណត់បានទេ", "bad"));
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function setCoupon(i, p) {
    set("coupons", form.coupons.map((c, j) => (j === i ? { ...c, ...p } : c)));
  }

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          coupons: (form.coupons || [])
            .filter((c) => c.code?.trim())
            .map((c) => ({
              code: String(c.code).trim().toUpperCase(),
              type: c.type === "fixed" ? "fixed" : "percent",
              value: Number(c.value) || 0,
              min: Number(c.min) || 0,
            })),
          autoTopup: !!form.autoTopup,
        }),
      });
      setForm({ ...saved, coupons: Array.isArray(saved.coupons) ? saved.coupons : [] });
      setDirty(false);
      toast("បានរក្សាទុកការកំណត់");
    } catch {
      toast("រក្សាទុកមិនបាន", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <div className="ad-loading"><span className="ad-spin" /> កំពុងផ្ទុក…</div>;

  return (
    <form onSubmit={save} className="ad-settings">
      <PageHead km="ការកំណត់" en="Site info, announcements, store status and coupons" />

      <section className="ad-card">
        <h2>ព័ត៌មានហាង</h2>
        <div className="ad-row2">
          <Field label="ឈ្មោះហាង">
            <input value={form.siteName || ""} onChange={(e) => set("siteName", e.target.value)} />
          </Field>
          <Field label="អ៊ីមែលជំនួយ">
            <input value={form.supportEmail || ""} onChange={(e) => set("supportEmail", e.target.value)} />
          </Field>
          <Field label="ពាក្យស្លោក (ខ្មែរ)">
            <input value={form.taglineKm || ""} onChange={(e) => set("taglineKm", e.target.value)} />
          </Field>
          <Field label="Tagline (English)">
            <input value={form.taglineEn || ""} onChange={(e) => set("taglineEn", e.target.value)} />
          </Field>
        </div>
        <Field label="តំណ Telegram">
          <input value={form.telegram || ""} onChange={(e) => set("telegram", e.target.value)} placeholder="https://t.me/…" />
        </Field>
      </section>

      <section className="ad-card">
        <h2>សេចក្តីជូនដំណឹង</h2>
        <p className="ad-hint">បង្ហាញនៅលើទំព័រហាង (ទុកទទេ ប្រសិនបើមិនចង់បង្ហាញ)</p>
        <div className="ad-row2">
          <Field label="ជាភាសាខ្មែរ">
            <textarea value={form.announcementKm || ""} onChange={(e) => set("announcementKm", e.target.value)} />
          </Field>
          <Field label="In English">
            <textarea value={form.announcementEn || ""} onChange={(e) => set("announcementEn", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="ad-card">
        <h2>ស្ថានភាពហាង</h2>
        <div className="ad-toggle-row">
          <div>
            <strong>បញ្ចូលហ្គេមស្វ័យប្រវត្តិ</strong>
            <small>បន្ទាប់ពីអតិថិជនបង់ប្រាក់ ប្រព័ន្ធបញ្ជាទិញទៅ Khmer TopUp ដោយខ្លួនឯង</small>
          </div>
          <Switch checked={!!form.autoTopup} onChange={(v) => set("autoTopup", v)} label="Auto top-up" />
        </div>
        <div className="ad-toggle-row">
          <div>
            <strong>បិទហាងបណ្តោះអាសន្ន</strong>
            <small>អតិថិជនមិនអាចបង្កើតការបញ្ជាទិញថ្មីបានទេ ពេលបើកមុខងារនេះ</small>
          </div>
          <Switch checked={!!form.maintenance} onChange={(v) => set("maintenance", v)} label="Maintenance" />
        </div>
      </section>

      <section className="ad-card">
        <h2>កូដបញ្ចុះតម្លៃ</h2>
        {form.coupons.length > 0 ? (
          <div className="ad-coupon head">
            <span>កូដ</span>
            <span>ប្រភេទ</span>
            <span>តម្លៃ</span>
            <span>អប្បបរមា $</span>
            <span />
          </div>
        ) : (
          <p className="ad-empty">មិនទាន់មានកូដបញ្ចុះតម្លៃទេ</p>
        )}
        {form.coupons.map((c, i) => (
          <div key={i} className="ad-coupon">
            <input placeholder="CODE" value={c.code} onChange={(e) => setCoupon(i, { code: e.target.value })} />
            <select value={c.type} onChange={(e) => setCoupon(i, { type: e.target.value })}>
              <option value="percent">ភាគរយ %</option>
              <option value="fixed">ចំនួន $</option>
            </select>
            <input type="number" step="0.01" min="0" value={c.value} onChange={(e) => setCoupon(i, { value: e.target.value })} />
            <input type="number" step="0.01" min="0" value={c.min} onChange={(e) => setCoupon(i, { min: e.target.value })} />
            <button type="button" className="ad-icon-btn danger" aria-label="Remove coupon" onClick={() => set("coupons", form.coupons.filter((_, j) => j !== i))}>
              <AIcon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button type="button" className="ad-btn soft" onClick={() => set("coupons", [...form.coupons, { ...emptyCoupon }])}>
          + បន្ថែមកូដ
        </button>
      </section>

      <div className="ad-savebar">
        <span className={dirty ? "wait" : "ok"}>{dirty ? "មានការផ្លាស់ប្តូរមិនទាន់រក្សាទុក" : "គ្មានការផ្លាស់ប្តូរ"}</span>
        <button type="submit" className="ad-btn primary" disabled={saving || !dirty}>
          {saving ? <span className="ad-spin light" /> : <AIcon name="check" size={16} />} រក្សាទុក
        </button>
      </div>
    </form>
  );
}
