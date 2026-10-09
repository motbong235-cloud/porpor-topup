import { useEffect, useState } from "react";
import { games } from "../../data/catalog";
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
        closedGames: Array.isArray(s.closedGames) ? s.closedGames : [],
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
          defaultWallet: Number(form.defaultWallet) || 0,
          coupons: (form.coupons || [])
            .filter((c) => c.code?.trim())
            .map((c) => ({
              code: String(c.code).trim().toUpperCase(),
              type: c.type === "fixed" ? "fixed" : "percent",
              value: Number(c.value) || 0,
              min: Number(c.min) || 0,
            })),
          packageMap: typeof form.packageMap === "string" ? JSON.parse(form.packageMap || "{}") : (form.packageMap || {}),
          autoTopup: !!form.autoTopup,
          allowDemoPay: form.allowDemoPay !== false,
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
      <p className="page-lead">Full site configuration — name, Telegram, coupons, closed games, maintenance.</p>
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
          <div className="field">
            <label>Default wallet balance ($)</label>
            <input
              type="number"
              step="0.1"
              value={form.defaultWallet ?? 8.5}
              onChange={(e) => set("defaultWallet", e.target.value)}
            />
          </div>
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
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.allowDemoPay !== false}
                onChange={(e) => set("allowDemoPay", e.target.checked)}
              />
              Allow demo pay (when ABA keys missing)
            </label>
          </div>
        </div>

        <div className="field">
          <label>Package map (local pack id → Khmer TopUp package_id)</label>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            JSON object, e.g. {"ml-86": 268, "ff-100": 301}. Get IDs from GET /api/admin/kt-games
          </p>
          <textarea
            value={typeof form.packageMap === "string" ? form.packageMap : JSON.stringify(form.packageMap || {}, null, 2)}
            onChange={(e) => {
              try {
                set("packageMap", JSON.parse(e.target.value || "{}"));
              } catch {
                set("packageMap", e.target.value);
              }
            }}
            style={{ fontFamily: "ui-monospace, monospace", minHeight: 120 }}
          />
        </div>

        <div className="field">
          <label>Closed games (ផ្អាក)</label>
          <div className="games-checks">
            {games.map((g) => {
              const closed = (form.closedGames || []).includes(g.id);
              return (
                <label key={g.id}>
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) => {
                      const setIds = new Set(form.closedGames || []);
                      if (e.target.checked) setIds.add(g.id);
                      else setIds.delete(g.id);
                      set("closedGames", Array.from(setIds));
                    }}
                  />
                  {g.name}
                </label>
              );
            })}
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
