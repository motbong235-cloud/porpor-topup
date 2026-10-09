import { useEffect, useState } from "react";
import { api } from "./AdminLayout";

const emptyCoupon = { code: "", type: "percent", value: 10, min: 0 };

export default function SettingsAdmin() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/admin/settings").then((s) =>
      setForm({
        ...s,
        coupons: Array.isArray(s.coupons) ? s.coupons : [],
      }),
    );
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
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
      setForm(saved);
      setMsg("Saved ✓");
    } catch {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p style={{ color: "var(--muted)" }}>Loading settings…</p>;

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-lead">Site configuration — name, Telegram, coupons, maintenance. Choose which games to sell in Services.</p>
      <form className="settings-form" onSubmit={save}>
        <div className="row2">
          <div className="field">
            <label>Site name</label>
            <input value={form.siteName || ""} onChange={(e) => set("siteName", e.target.value)} />
          </div>
          <div className="field">
            <label>Support email</label>
            <input value={form.supportEmail || ""} onChange={(e) => set("supportEmail", e.target.value)} />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Tagline (ខ្មែរ)</label>
            <input value={form.taglineKm || ""} onChange={(e) => set("taglineKm", e.target.value)} />
          </div>
          <div className="field">
            <label>Tagline (EN)</label>
            <input value={form.taglineEn || ""} onChange={(e) => set("taglineEn", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Telegram URL</label>
          <input value={form.telegram || ""} onChange={(e) => set("telegram", e.target.value)} />
        </div>
        <div className="row2">
          <div className="field">
            <label>Announcement (ខ្មែរ)</label>
            <textarea value={form.announcementKm || ""} onChange={(e) => set("announcementKm", e.target.value)} />
          </div>
          <div className="field">
            <label>Announcement (EN)</label>
            <textarea value={form.announcementEn || ""} onChange={(e) => set("announcementEn", e.target.value)} />
          </div>
        </div>
        <div className="row2">
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!form.maintenance}
                onChange={(e) => set("maintenance", e.target.checked)}
              />
              Maintenance mode (បិទហាង)
            </label>
          </div>
        </div>

        <div className="field">
          <label>Coupon codes</label>
          <div className="coupon-list">
            {(form.coupons || []).map((c, i) => (
              <div key={i} className="coupon-row">
                <input
                  placeholder="CODE"
                  value={c.code}
                  onChange={(e) => {
                    const coupons = [...form.coupons];
                    coupons[i] = { ...c, code: e.target.value };
                    set("coupons", coupons);
                  }}
                />
                <select
                  value={c.type}
                  onChange={(e) => {
                    const coupons = [...form.coupons];
                    coupons[i] = { ...c, type: e.target.value };
                    set("coupons", coupons);
                  }}
                >
                  <option value="percent">%</option>
                  <option value="fixed">Fixed $</option>
                </select>
                <input
                  type="number"
                  placeholder="Value"
                  value={c.value}
                  onChange={(e) => {
                    const coupons = [...form.coupons];
                    coupons[i] = { ...c, value: e.target.value };
                    set("coupons", coupons);
                  }}
                />
                <input
                  type="number"
                  placeholder="Min $"
                  value={c.min}
                  onChange={(e) => {
                    const coupons = [...form.coupons];
                    coupons[i] = { ...c, min: e.target.value };
                    set("coupons", coupons);
                  }}
                />
                <button
                  type="button"
                  onClick={() => set("coupons", form.coupons.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-soft"
              style={{ width: "fit-content" }}
              onClick={() => set("coupons", [...(form.coupons || []), { ...emptyCoupon }])}
            >
              + Add coupon
            </button>
          </div>
        </div>

        <div className="row2">
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!form.autoTopup}
                onChange={(e) => set("autoTopup", e.target.checked)}
              />
              Auto top-up via Khmer TopUp
            </label>
          </div>
        </div>

        <div className="save-bar">
          <button type="submit" className="bg-brand" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
          {msg ? <span className={`msg ${msg.includes("fail") ? "err" : "ok"}`}>{msg}</span> : null}
        </div>
      </form>
    </div>
  );
}
