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
  const [robuxTesting, setRobuxTesting] = useState(false);
  const [robuxTest, setRobuxTest] = useState("");

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
          topupProvider: form.topupProvider || "khmer",
          logoUrl: form.logoUrl || "",
          bannerUrls: (form.bannerUrls || []).filter(Boolean).slice(0, 5),
          tgBotUsername: String(form.tgBotUsername || "").trim().replace(/^@/, ""),
          tgChannelId: String(form.tgChannelId || "").trim(),
        };
      // កុំលុប token ចាស់ បើ field ទុកទទេ (password input)
      if (!String(form.tgBotToken || "").trim()) {
        delete payload.tgBotToken;
      }
      if (!String(form.robuxCookie || "").trim() || form.robuxCookie === "••••••••") {
        delete payload.robuxCookie;
      }
      if (!String(form.robuxTotpSecret || "").trim() || form.robuxTotpSecret === "••••••••") {
        delete payload.robuxTotpSecret;
      }
      if (!String(form.rielpayApiKey || "").trim() || form.rielpayApiKey === "••••••••") {
        delete payload.rielpayApiKey;
      }
      if (!String(form.rielpayWebhookSecret || "").trim() || form.rielpayWebhookSecret === "••••••••") {
        delete payload.rielpayWebhookSecret;
      }
      payload.robuxAutoEnabled = !!form.robuxAutoEnabled;
      if (form.robuxGroupId !== undefined) payload.robuxGroupId = form.robuxGroupId;
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
        <a href="#set-robux" className="ad-seg-a">Robux Auto</a>
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
        <p className="ad-hint" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <AIcon name={form.tgBotUsername ? "check" : "alert"} size={15} />
          {form.tgBotUsername
            ? `Username: @${String(form.tgBotUsername).replace(/^@/, "")}${form.tgBotToken ? " · Token មាន" : " · Token (បើមានរួច កុំបំពេញម្តងទៀត)"}`
            : "បំពេញ Bot Username + Token រួច Save"}
        </p>
        <p className="ad-hint" style={{ marginTop: 6 }}>
          <b>សំខាន់:</b> BotFather → <code>/setdomain</code> ត្រូវដាក់ <code>www.porportopup.com</code>
          (ត្រូវនឹង domain ដែលអ្នកប្រើប្រាស់ — មិនមែន porportopup.com គ្មាន www)
        </p>
      </section>


      <section className="ad-card" id="set-kai">
        <h2>Kai- Bot (TikTok Khmer only)</h2>
        <p className="ad-hint">
          Order <b>TikTok Khmer</b> នឹងផ្ញើសារទៅ <b>bot Kai-</b> តែមួយ។ Service ផ្សេងរបស់ Porpor នៅផ្ញើ Channel Porpor ដដែល។
        </p>
        <div className="ad-grid-2">
          <Field label="Kai Bot Token" hint="Token bot Kai- (ឬ Order Bot token)">
            <input
              type="password"
              value={form.kaiBotToken || ""}
              onChange={(e) => set("kaiBotToken", e.target.value)}
              placeholder={form.kaiBotToken ? "••••••••" : "123456:AAH…"}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Kai Bot Username" hint="សម្រាប់បើក t.me/… (គ្មាន @)">
            <input
              value={form.kaiBotUsername || ""}
              onChange={(e) => set("kaiBotUsername", e.target.value)}
              placeholder="KaiJakLikeBot"
              autoComplete="off"
            />
          </Field>
          <Field label="Kai Order Chat ID" hint="សំខាន់! Chat ID ឯកជន/Group Order Bot (លេខ -100… ឬ user id) — បើទទេ សារទៅតែ Channel">
            <input
              value={form.kaiChatId || ""}
              onChange={(e) => set("kaiChatId", e.target.value)}
              placeholder="1784262198"
              autoComplete="off"
            />
          </Field>
          <Field label="Kai Channel ID" hint="Channel Kai- — សារសាធារណៈ (Link: Private)">
            <input
              value={form.kaiChannelId || ""}
              onChange={(e) => set("kaiChannelId", e.target.value)}
              placeholder="-100…"
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label="Route game IDs / keywords" hint="ខណ្ឌដោយក្បៀស — match gameId ឬឈ្មោះ">
          <input
            value={form.kaiRouteGames || "tiktok-khmer,tiktok khmer"}
            onChange={(e) => set("kaiRouteGames", e.target.value)}
            placeholder="tiktok-khmer,tiktok khmer"
          />
        </Field>
        <h3 style={{ marginTop: 16, fontSize: 14 }}>Kai- (TikTok route — optional)</h3>
        <p className="ad-hint">QR ទាំងអស់ប្រើ RielPay។ Key ខាងក្រោមសម្រាប់ notify / legacy តែប៉ុណ្ណោះ (មិនបង្កើត QR)។</p>
        <div className="ad-grid-2">
          <Field label="Kai ABA Profile Key">
            <input
              type="password"
              value={form.kaiAbaKey || ""}
              onChange={(e) => set("kaiAbaKey", e.target.value)}
              placeholder={form.kaiAbaKey ? "••••••••" : "PK_…"}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Kai ABA Merchant ID">
            <input
              value={form.kaiAbaMerchant || ""}
              onChange={(e) => set("kaiAbaMerchant", e.target.value)}
              placeholder="ឧ. r72mCt"
              autoComplete="off"
            />
          </Field>
        </div>
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
        <h2>ការទូទាត់ — ABA PayWay</h2>
        <p className="ad-hint">
          TikTok Khmer និង QR បង់ប្រាក់ប្រើ <b>ABA PayWay</b>។
          បំពេញ API Key ខាងក្រោម ឬដាក់ env <code>RIELPAY_API_KEY</code> លើ Render (env មានអាទិភាព)។
          Webhook: <code>/api/webhook/rielpay</code>
        </p>
        <div className="ad-grid-2">
          <Field label="ABA PayWay API Key" hint="ទុកទទេពេល Save = រក្សាចាស់">
            <input
              type="password"
              value={form.rielpayApiKey === "••••••••" ? "" : (form.rielpayApiKey || "")}
              onChange={(e) => set("rielpayApiKey", e.target.value)}
              placeholder={form.rielpayApiKey ? "••••••••" : "sk_..."}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Webhook Secret (optional)" hint="ទុកទទេ = រក្សាចាស់">
            <input
              type="password"
              value={form.rielpayWebhookSecret === "••••••••" ? "" : (form.rielpayWebhookSecret || "")}
              onChange={(e) => set("rielpayWebhookSecret", e.target.value)}
              placeholder={form.rielpayWebhookSecret ? "••••••••" : "whsec_..."}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <button type="button" className="ad-btn ghost" disabled={testing} onClick={testPayment}>
          {testing ? "…" : "Test ABA PayWay"}
        </button>
        {testOut ? <pre className="ad-pre">{testOut}</pre> : null}
      </section>

      
      <section className="ad-card" id="set-robux">
        <h2>Robux Send Auto (Group Payout)</h2>
        <p className="ad-hint">
          បើបើក — បន្ទាប់ពីអតិថិជនបង់លុយ ប្រព័ន្ធព្យាយាមផ្ញើ Robux ពី <b>Group Community Funds</b>។
          បើ Roblox ត្រូវ Challenge នឹងនៅ manual។ កុំ share Cookie ក្នុង chat។
        </p>
        <div className="ad-toggle-row">
          <div>
            <strong>បើក Auto Group Payout</strong>
            <small>ត្រូវមាន Cookie + Group ID · Group ត្រូវមាន Robux</small>
          </div>
          <Switch checked={!!form.robuxAutoEnabled} onChange={(v) => set("robuxAutoEnabled", v)} label="Robux auto" />
        </div>
        <div className="ad-grid-2">
          <Field label="Group ID" hint="ឧ. 981305109">
            <input value={form.robuxGroupId || ""} onChange={(e) => set("robuxGroupId", e.target.value)} placeholder="981305109" autoComplete="off" />
          </Field>
          <Field label="TOTP Secret (2FA)" hint="ទុកទទេ = រក្សាចាស់">
            <input type="password" value={form.robuxTotpSecret === "••••••••" ? "" : (form.robuxTotpSecret || "")} onChange={(e) => set("robuxTotpSecret", e.target.value)} placeholder={form.robuxTotpSecret ? "••••••••" : "Base32 secret"} autoComplete="new-password" />
          </Field>
        </div>
        <Field label=".ROBLOSECURITY Cookie" hint="ទុកទទេពេល Save = មិនលុប cookie ចាស់">
          <textarea
            value={form.robuxCookie === "••••••••" ? "" : (form.robuxCookie || "")}
            onChange={(e) => set("robuxCookie", e.target.value)}
            placeholder={form.robuxCookie ? "(មានរួច — បំពេញម្ដងទៀតបើចង់ប្ដូរ)" : "_|WARNING:-DO-NOT-SHARE-THIS.…"}
            rows={3}
            autoComplete="off"
            style={{ fontFamily: "monospace", fontSize: 12 }}
          />
        </Field>
        <button
          type="button"
          className="ad-btn soft"
          disabled={robuxTesting}
          onClick={async () => {
            setRobuxTesting(true);
            setRobuxTest("");
            try {
              setRobuxTest(JSON.stringify(await api("/api/admin/robux-auto/test"), null, 2));
            } catch {
              setRobuxTest("test failed");
            } finally {
              setRobuxTesting(false);
            }
          }}
        >
          {robuxTesting ? "កំពុងពិនិត្យ…" : "ពិនិត្យ Group Funds / Cookie"}
        </button>
        {robuxTest ? (
          <pre style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{robuxTest}</pre>
        ) : null}
      </section>

<section className="ad-card">
        <h2>ស្ថានភាពហាង</h2>
        <div className="ad-toggle-row">
          <div>
            <strong>បញ្ចូលហ្គេមស្វ័យប្រវត្តិ</strong>
            <small>បន្ទាប់ពីបង់ប្រាក់ — ប្រព័ន្ធបញ្ជាទិញទៅ provider ដែលជ្រើស (ខាងក្រោម)</small>
          </div>
          <Switch checked={!!form.autoTopup} onChange={(v) => set("autoTopup", v)} label="Auto top-up" />
        </div>

        <div className="ad-provider-split">
          <p className="ad-provider-title">ជ្រើស Top-up provider</p>
          <div className="ad-provider-cards ad-provider-3">
            {[
              {
                id: "khmer",
                title: "Khmer TopUp",
                desc: "Env: KHMER_TOPUP_API_KEY · Catalog tab Khmer TopUp",
              },
              {
                id: "dino",
                title: "Dino Topups",
                desc: "Env: DINO_TOPUP_API_KEY · Catalog tab Dino",
              },
              {
                id: "both",
                title: "Khmer + Dino",
                desc: "រួមគ្នា — game បើកក្នុង tab Dino ប្រើ Dino, ផ្សេងទៀតប្រើ Khmer",
              },
            ].map((opt) => {
              const cur = form.topupProvider || "khmer";
              const on = cur === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`ad-provider-card${on ? " on" : ""}`}
                  onClick={() => set("topupProvider", opt.id)}
                  aria-pressed={on}
                >
                  <span className={`ad-provider-radio${on ? " on" : ""}`} aria-hidden />
                  <span className="ad-provider-text">
                    <strong>{opt.title}</strong>
                    <small>{opt.desc}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="ad-muted" style={{ marginTop: 8 }}>
            ចុចជ្រើស → រួចចុច <b>រក្សាទុកការកំណត់</b>។ Both = Dino សម្រាប់ game ដែល enable ក្នុង tab Dino។
          </p>
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
          <AIcon name="plus" size={15} /> បន្ថែមកូដ
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
          <AIcon name="download" size={15} /> ទាញ Backup ពេញ
        </a>
      </section>
    </form>
  );
}
