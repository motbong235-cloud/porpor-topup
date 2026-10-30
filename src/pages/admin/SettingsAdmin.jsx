import { useEffect, useState } from "react";
import { AIcon, PageHead, Switch, WideImageSlot, api, toast } from "./ui";

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
  const [testing, setTesting] = useState(false);
  const [testOut, setTestOut] = useState("");

  async function testPayment() {
    setTesting(true);
    setTestOut("");
    try {
      setTestOut(JSON.stringify(await api("/api/admin/payment-test"), null, 2));
    } catch {
      setTestOut("ហៅមិនបាន");
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    api("/api/admin/settings")
      .then((s) => setForm({ ...s, coupons: Array.isArray(s.coupons) ? s.coupons : [], bannerUrls: Array.isArray(s.bannerUrls) ? s.bannerUrls : [] }))
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
      const payload = {
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
          logoUrl: form.logoUrl || "",
          bannerUrls: (form.bannerUrls || []).filter(Boolean).slice(0, 5),
          tgBotUsername: String(form.tgBotUsername || "").trim().replace(/^@/, ""),
          tgChannelId: String(form.tgChannelId || "").trim(),
        };
      // កុំលុប token ចាស់ បើ field ទុកទទេ (password input)
      if (!String(form.tgBotToken || "").trim()) {
        delete payload.tgBotToken;
      }
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setForm({ ...saved, coupons: Array.isArray(saved.coupons) ? saved.coupons : [], bannerUrls: Array.isArray(saved.bannerUrls) ? saved.bannerUrls : [] });
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

      <div className="ad-seg ad-seg-scroll">
        <a href="#set-shop" className="ad-seg-a">ហាង</a>
        <a href="#set-brand" className="ad-seg-a">Logo / Banner</a>
        <a href="#set-tg" className="ad-seg-a">Telegram</a>
        <a href="#set-pay" className="ad-seg-a">Payment</a>
        <a href="#set-coupon" className="ad-seg-a">Coupon</a>
        <a href="#set-backup" className="ad-seg-a">Backup</a>
      </div>

      <section className="ad-card" id="set-shop">
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

      <section className="ad-card" id="set-tg">
        <h2>Telegram Login</h2>
        <div className="ad-grid-2">
          <Field label="Bot Username (គ្មាន @)" hint="BotFather → /setdomain = domain website">
            <input
              value={form.tgBotUsername || ""}
              onChange={(e) => set("tgBotUsername", e.target.value)}
              placeholder="PorPorTopupBot"
              autoComplete="off"
            />
          </Field>
          <Field label="Bot Token" hint="ទុកទទេ = រក្សា token ចាស់">
            <input
              type="password"
              value={form.tgBotToken || ""}
              onChange={(e) => set("tgBotToken", e.target.value)}
              placeholder={form.tgBotToken ? "••••••••" : "123456:AAH…"}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <p className="ad-hint" style={{ marginTop: 8 }}>
          {form.tgBotUsername
            ? `✅ Username: @${String(form.tgBotUsername).replace(/^@/, "")}${form.tgBotToken ? " · Token មាន" : " · Token (បើមានរួច កុំបំពេញម្តងទៀត)"}`
            : "⚠️ បំពេញ Bot Username + Token រួច Save"}
        </p>
        <p className="ad-hint" style={{ marginTop: 6 }}>
          <b>សំខាន់:</b> BotFather → <code>/setdomain</code> ត្រូវដាក់ <code>www.porportopup.com</code>
          (ត្រូវនឹង domain ដែលអ្នកប្រើប្រាស់ — មិនមែន porportopup.com គ្មាន www)
        </p>
      </section>

      <section className="ad-card">
        <h2 id="set-brand-h">Logo គេហទំព័រ</h2>
        <p className="ad-hint">បង្ហាញនៅ Header ហើយក៏ជា Favicon (រូបតូចក្នុង Google/Browser) និង Icon របស់ App ពេលអតិថិជន Download ។ ណែនាំរូបការ៉េ (PNG ផ្ទៃថ្លា) ទំហំ 512×512 ។ ទុកទទេ = ប្រើ "PP" ដើម</p>
        <WideImageSlot
          src={form.logoUrl}
          ratio="1 / 1"
          width={140}
          maxWidth={512}
          contain
          label="ដាក់ Logo"
          onUrl={(url) => set("logoUrl", url)}
          onClear={() => set("logoUrl", "")}
        />
      </section>

      <section className="ad-card">
        <h2>Banner គេហទំព័រ</h2>
        <p className="ad-hint">
          បង្ហាញនៅទំព័រដើម (ស្លាយអូតូ) ។ ណែនាំទំហំ 1600×500 (សមាមាត្រ 16:5) អតិបរមា 5 រូប ។ ទុកទទេ = ប្រើ Banner ដើម
        </p>
        <div className="ad-banners">
          {form.bannerUrls.map((url, i) => (
            <WideImageSlot
              key={i}
              src={url}
              ratio="16 / 5"
              maxWidth={1600}
              label="ប្តូរ Banner"
              onUrl={(u) => set("bannerUrls", form.bannerUrls.map((x, j) => (j === i ? u : x)))}
              onClear={() => set("bannerUrls", form.bannerUrls.filter((_, j) => j !== i))}
            />
          ))}
          {form.bannerUrls.length < 5 ? (
            <WideImageSlot
              key={`new-${form.bannerUrls.length}`}
              ratio="16 / 5"
              maxWidth={1600}
              label="+ បន្ថែម Banner"
              hint="1600×500"
              onUrl={(u) => set("bannerUrls", [...form.bannerUrls, u])}
            />
          ) : null}
        </div>
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

      <section className="ad-card" id="set-pay">
        <h2>ពិនិត្យការតភ្ជាប់ការទូទាត់ (ABA PayWay)</h2>
        <p className="ad-hint">សាកល្បងបង្កើត QR $0.01 ដោយប្រើ ABA_API_KEY / ABA_MERCHANT_ID ក្នុង Render ហើយបង្ហាញចម្លើយពិតរបស់ API</p>
        <button type="button" className="ad-btn soft" onClick={testPayment} disabled={testing}>
          {testing ? "កំពុងសាកល្បង…" : "សាកល្បងឥឡូវ"}
        </button>
        {testOut ? <pre style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{testOut}</pre> : null}
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


      <section className="ad-card">
        <h2>Reseller (តម្លៃថេរ $ — មិនមែន %)</h2>
        <p className="ad-muted" style={{ marginBottom: 12 }}>
          ជ្រើស <strong>Telegram username</strong> របស់អ្នកលក់បន្ត។ ពេលគេ Login TG ក្នុង website នឹងឃើញ/បង់តម្លៃ reseller ថេរ (USD) ដែលអ្នកកំណត់តាម Pack ID។
        </p>
        <h3 style={{ fontSize: 14, margin: "8px 0" }}>Username Reseller</h3>
        {(form.resellers || []).map((r, i) => (
          <div key={i} className="ad-coupon" style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto" }}>
            <input
              placeholder="username (គ្មាន @)"
              value={r.username || ""}
              onChange={(e) =>
                set(
                  "resellers",
                  form.resellers.map((x, j) => (j === i ? { ...x, username: e.target.value } : x)),
                )
              }
            />
            <input
              placeholder="Telegram ID (optional)"
              value={r.telegramId || ""}
              onChange={(e) =>
                set(
                  "resellers",
                  form.resellers.map((x, j) => (j === i ? { ...x, telegramId: e.target.value } : x)),
                )
              }
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={r.active !== false}
                onChange={(e) =>
                  set(
                    "resellers",
                    form.resellers.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)),
                  )
                }
              />
              Active
            </label>
            <button
              type="button"
              className="ad-icon-btn danger"
              onClick={() => set("resellers", form.resellers.filter((_, j) => j !== i))}
            >
              <AIcon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ad-btn soft"
          onClick={() => set("resellers", [...(form.resellers || []), { username: "", telegramId: "", active: true }])}
        >
          + បន្ថែម username
        </button>

        <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>តម្លៃ Reseller ថេរ តាម Pack ID ($)</h3>
        <p className="ad-muted" style={{ marginBottom: 8 }}>
          Pack ID យកពី Admin → Services (លេខ package របស់ Khmer TopUp ឬ id gift card)។ តម្លៃជា <strong>ដុល្លាថេរ</strong> មិនមែនភាគរយ។
        </p>
        {Object.entries(form.resellerPrices || {}).map(([packId, price], i) => (
          <div key={packId + i} className="ad-coupon" style={{ gridTemplateColumns: "1.6fr 1fr auto" }}>
            <input
              placeholder="Pack ID"
              value={packId}
              onChange={(e) => {
                const next = { ...(form.resellerPrices || {}) };
                const val = next[packId];
                delete next[packId];
                const nk = e.target.value.trim();
                if (nk) next[nk] = val;
                set("resellerPrices", next);
              }}
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="តម្លៃ $"
              value={price}
              onChange={(e) =>
                set("resellerPrices", { ...(form.resellerPrices || {}), [packId]: e.target.value })
              }
            />
            <button
              type="button"
              className="ad-icon-btn danger"
              onClick={() => {
                const next = { ...(form.resellerPrices || {}) };
                delete next[packId];
                set("resellerPrices", next);
              }}
            >
              <AIcon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ad-btn soft"
          onClick={() => {
            let k = "pack-id";
            let n = 1;
            const cur = form.resellerPrices || {};
            while (cur[k]) {
              k = `pack-id-${n++}`;
            }
            set("resellerPrices", { ...cur, [k]: 1 });
          }}
        >
          + បន្ថែមតម្លៃ pack
        </button>
      </section>

      <div className="ad-savebar">
        <span className={dirty ? "wait" : "ok"}>{dirty ? "មានការផ្លាស់ប្តូរមិនទាន់រក្សាទុក" : "គ្មានការផ្លាស់ប្តូរ"}</span>
        <button type="submit" className="ad-btn primary" disabled={saving || !dirty}>
          {saving ? <span className="ad-spin light" /> : <AIcon name="check" size={16} />} រក្សាទុក
        </button>
      </div>

      <section className="ad-card" id="set-backup">
        <h2>Backup / ទាញ data</h2>
        <p className="ad-hint">ទាញ file JSON ទុកមុនពេលដូរ server — មាន settings, orders, stock, live chat</p>
        <a className="ad-btn soft" href="/api/admin/backup" target="_blank" rel="noreferrer">
          ទាញ Backup ពេញ
        </a>
      </section>
    </form>
  );
}
