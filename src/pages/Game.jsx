import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { t } from "../lib/i18n";
import { applyCoupon, money } from "../lib/store";
import { GameTile, Icon } from "../components/Icons";

export default function Game({ lang, addOrder, settings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, loading } = useCatalog();
  const game = games.find((g) => g.id === id) || null;

  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [server, setServer] = useState("");
  const [nick, setNick] = useState("");
  const [checkedFor, setCheckedFor] = useState("");
  const [checking, setChecking] = useState(false);
  const [packId, setPackId] = useState(null);
  const [qty, setQty] = useState(1);
  const [cat, setCat] = useState("all");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [couponMsg, setCouponMsg] = useState({ type: "", text: "" });
  const [payErr, setPayErr] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [liveQr, setLiveQr] = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);
  const [paying, setPaying] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [unverified, setUnverified] = useState(false);

  const cats = useMemo(() => {
    if (!game) return ["all"];
    return ["all", ...Array.from(new Set(game.packs.map((p) => p.category)))];
  }, [game]);

  const pack = game?.packs.find((p) => p.id === packId) || null;
  const sub = pack ? Math.round(pack.price * qty * 100) / 100 : 0;
  const total = Math.max(0, Math.round((sub - applied) * 100) / 100);

  // auto-check payment while the QR is open
  useEffect(() => {
    if (!qrOpen || !checkoutId) return undefined;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/checkout/${checkoutId}/status`);
        const d = await r.json();
        if (d.order && d.order.status !== "pending") {
          setQrOpen(false);
          navigate(`/track?code=${encodeURIComponent(checkoutId)}`);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(timer);
  }, [qrOpen, checkoutId, navigate]);

  if (loading && !game) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "96px 16px" }}>
        <p className="page-lead">{t(lang, "catalogLoading")}</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "96px 16px" }}>
        <h1 className="page-title">{t(lang, "missing")}</h1>
        <p className="page-lead">{t(lang, "missingBody")}</p>
        <Link className="btn bg-brand" style={{ marginTop: 24 }} to="/">
          {t(lang, "back")}
        </Link>
      </div>
    );
  }

  if (!game.open) {
    return (
      <div className="container">
        <nav className="crumb">
          <Link to="/">{t(lang, "home")}</Link> · <span>{game.name}</span>
        </nav>
        <div className="hero-game">
          <GameTile game={game} />
          <div>
            {game.region ? <div className="region">{game.region}</div> : null}
            <h1>{game.name}</h1>
            {(lang === "km" ? game.blurbKm : game.blurbEn) ? (
            <p className="blurb">{lang === "km" ? game.blurbKm : game.blurbEn}</p>
          ) : null}
          </div>
        </div>
        <div className="card" style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ fontWeight: 600 }}>{t(lang, "paused")}</p>
          <Link className="btn bg-brand" style={{ marginTop: 16 }} to="/support">
            {t(lang, "chat")}
          </Link>
        </div>
      </div>
    );
  }

  function verify() {
    if (userId.trim().length < 3) {
      setNick("");
      setCheckedFor("");
      return;
    }
    if (game.hasZone && !zoneId.trim()) return;
    if (game.servers.length && !server) return;
    const key = `${userId.trim()}|${zoneId.trim()}|${server}`;
    setChecking(true);
    setUnverified(false);
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: game.id,
        playerId: userId.trim(),
        serverId: zoneId.trim() || server || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.result === "valid") {
          setNick(data.nickname || "✓");
          setCheckedFor(key);
        } else if (data.result === "invalid") {
          setNick("");
          setCheckedFor("");
          setPayErr(t(lang, "idInvalid"));
        } else {
          // supplier could not check this game — let the customer continue, flagged as unverified
          setNick("");
          setUnverified(true);
          setCheckedFor(key);
        }
      })
      .catch(() => {
        setNick("");
        setUnverified(true);
        setCheckedFor(key);
      })
      .finally(() => setChecking(false));
  }

  function onCoupon() {
    const res = applyCoupon(coupon, sub || 1, settings?.coupons);
    if (!res.ok) {
      setApplied(0);
      setAppliedCode("");
      setCouponMsg({ type: "err", text: res.error === "min" ? t(lang, "couponMin") : t(lang, "couponBad") });
      return;
    }
    setApplied(sub ? res.discount : 0);
    setAppliedCode(res.code);
    setCouponMsg({ type: res.code ? "ok" : "", text: res.code ? t(lang, "couponOk") : "" });
  }

  function validate() {
    if (!packId) return t(lang, "needPack");
    if (userId.trim().length < 3) return t(lang, "needId");
    if (game.hasZone && !zoneId.trim()) return t(lang, "needZone");
    if (game.servers.length && !server) return t(lang, "needServer");
    if (checkedFor !== `${userId.trim()}|${zoneId.trim()}|${server}`) return t(lang, "needVerify");
    return "";
  }

  const ERRORS = {
    maintenance: { km: "ហាងកំពុងថែទាំ សូមព្យាយាមម្តងទៀតពេលក្រោយ", en: "The shop is under maintenance. Try again later." },
    not_configured: { km: "ការទូទាត់មិនទាន់រួចរាល់ សូមទាក់ទងអ្នកគ្រប់គ្រង", en: "Payments are not set up yet. Please contact support." },
    pack_unavailable: { km: "កញ្ចប់នេះមិនមានលក់ទៀតទេ សូមជ្រើសកញ្ចប់ផ្សេង", en: "This package is no longer available." },
    coupon_invalid: { km: "កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ", en: "Invalid coupon code." },
    coupon_min: { km: "ចំនួនទិញមិនដល់កម្រិតអប្បបរមានៃកូដនេះ", en: "Order is below this coupon's minimum." },
    catalog_unavailable: { km: "មិនអាចទាញតម្លៃបានទេ សូមព្យាយាមម្តងទៀត", en: "Could not load prices. Try again." },
  };

  async function place() {
    const p = pack;
    if (!p) return;
    setPayErr("");
    setPaying(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          packId: p.id,
          qty,
          userId: userId.trim(),
          zoneId: zoneId.trim(),
          server,
          nickname: nick,
          coupon: appliedCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const known = ERRORS[data.error];
        setPayErr(known ? known[lang] : data.error || "Checkout failed");
        return;
      }
      if (!data.payment?.qrImage) {
        setPayErr(ERRORS.not_configured[lang]);
        return;
      }
      addOrder(data.order);
      setOrderTotal(data.order.total);
      setLiveQr(data.payment.qrImage);
      setCheckoutId(data.order.id);
      setQrOpen(true);
    } catch (e) {
      setPayErr(e.message || "Network error");
    } finally {
      setPaying(false);
    }
  }

  function pay() {
    const msg = validate();
    setPayErr(msg);
    if (msg) return;
    place();
  }

  async function confirmQr() {
    if (!checkoutId) return;
    setPaying(true);
    setPayErr("");
    try {
      const r = await fetch(`/api/checkout/${checkoutId}/status`);
      const d = await r.json();
      if (d.order && d.order.status !== "pending") {
        setQrOpen(false);
        navigate(`/track?code=${encodeURIComponent(checkoutId)}`);
        return;
      }
      setPayErr(lang === "km" ? "មិនទាន់ទទួលការបង់" : "Payment not received yet");
    } catch (e) {
      setPayErr(e.message);
    } finally {
      setPaying(false);
    }
  }

  const statusText = checking
    ? t(lang, "checking")
    : unverified && checkedFor
      ? t(lang, "unverified")
      : nick
      ? `${t(lang, "verified")}: ${nick}`
      : userId.trim().length > 0 && userId.trim().length < 3
        ? t(lang, "shortId")
        : t(lang, "notChecked");

  const qrSrc =
    liveQr && (liveQr.startsWith("data:") || liveQr.startsWith("http"))
      ? liveQr
      : liveQr
        ? `data:image/png;base64,${liveQr}`
        : null;

  return (
    <div className="container">
      <nav className="crumb">
        <Link to="/">{t(lang, "home")}</Link> · <span>{game.name}</span>
      </nav>
      <div className="hero-game">
        <GameTile game={game} />
        <div>
          {game.region ? <div className="region">{game.region}</div> : null}
          <h1>{game.name}</h1>
          {(lang === "km" ? game.blurbKm : game.blurbEn) ? (
            <p className="blurb">{lang === "km" ? game.blurbKm : game.blurbEn}</p>
          ) : null}
          <div className="chips">
            <span className="chip">{t(lang, "statSpeed")}</span>
            <span className="chip">KHQR</span>
          </div>
        </div>
      </div>

      <div className="layout-2">
        <div style={{ display: "grid", gap: 24 }}>
          <section className="card">
            <h2>{t(lang, "account")}</h2>
            {(lang === "km" ? game.idHintKm : game.idHintEn) ? (
              <p className="hint">{lang === "km" ? game.idHintKm : game.idHintEn}</p>
            ) : null}
            <div className="form-grid">
              <label className="field">
                {t(lang, "playerId")}
                <input
                  value={userId}
                  inputMode={game.numericId ? "numeric" : "text"}
                  placeholder={game.numericId ? "12345678" : "Name#TAG"}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setNick("");
                    setCheckedFor("");
                  }}
                />
              </label>
              {game.hasZone && (
                <label className="field">
                  {lang === "km" ? game.zoneLabelKm : game.zoneLabelEn}
                  <input
                    value={zoneId}
                    inputMode="numeric"
                    placeholder="1234"
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      setNick("");
                      setCheckedFor("");
                    }}
                  />
                </label>
              )}
              {game.servers.length > 0 && (
                <label className="field">
                  {t(lang, "server")}
                  <select
                    value={server}
                    onChange={(e) => {
                      setServer(e.target.value);
                      setNick("");
                      setCheckedFor("");
                    }}
                  >
                    <option value="">{t(lang, "selectServer")}</option>
                    {game.servers.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="row-actions">
              <button type="button" className="btn-soft" onClick={verify}>
                {t(lang, "verify")}
              </button>
              <span className={`verify-status${nick ? " ok" : ""}`}>
                <Icon name={nick ? "check" : "badge"} size={16} /> {statusText}
              </span>
            </div>
          </section>

          <section className="card">
            <div className="pack-head">
              <h2>{t(lang, "packs")}</h2>
              <div className="qty">
                <span>{t(lang, "qty")}</span>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))}>
                  +
                </button>
              </div>
            </div>
            <div className="cats">
              {cats.map((c) => (
                <button key={c} type="button" className={`cat${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>
                  {c === "all" ? t(lang, "allCats") : c}
                </button>
              ))}
            </div>
            <div className="packs">
              {game.packs
                .filter((p) => cat === "all" || p.category === cat)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pack${packId === p.id ? " active" : ""}`}
                    onClick={() => {
                      setPackId(p.id);
                      const nextSub = Math.round(p.price * qty * 100) / 100;
                      const res = applyCoupon(coupon || appliedCode, nextSub || 1, settings?.coupons);
                      if (res.ok && res.code) {
                        setApplied(nextSub ? res.discount : 0);
                        setAppliedCode(res.code);
                      } else {
                        setApplied(0);
                      }
                    }}
                  >
                    <div className="cat-label">{p.category}</div>
                    <div className="name">{lang === "km" ? p.nameKm : p.name}</div>
                    {p.bonus ? <div className="bonus">{p.bonus}</div> : null}
                    <div className="price">{money(p.price)}</div>
                  </button>
                ))}
            </div>
          </section>

          <section className="card">
            <h2>{t(lang, "payment")}</h2>
            <div className="pay-choices">
              <div className="pay-choice active">
                <span style={{ color: "var(--primary)" }}>
                  <Icon name="badge" />
                </span>
                <span>
                  <strong>{t(lang, "khqr")}</strong>
                  <span>{t(lang, "khqrHint")}</span>
                </span>
              </div>
            </div>
            <div className="coupon-row">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder={t(lang, "coupon")} />
              <button type="button" onClick={onCoupon}>
                {t(lang, "apply")}
              </button>
            </div>
            {couponMsg.text ? <p className={`msg ${couponMsg.type}`}>{couponMsg.text}</p> : null}
          </section>
        </div>

        <aside className="card summary">
          <h2>{t(lang, "summary")}</h2>
          <dl>
            <div className="row">
              <dt>{t(lang, "items")}</dt>
              <dd>{pack ? (lang === "km" ? pack.nameKm : pack.name) : "—"}</dd>
            </div>
            <div className="row">
              <dt>{t(lang, "qty")}</dt>
              <dd>{qty}</dd>
            </div>
            <div className="row">
              <dt>{t(lang, "nickname")}</dt>
              <dd>{nick || "—"}</dd>
            </div>
            <div className="row">
              <dt>{t(lang, "subtotal")}</dt>
              <dd>{money(sub)}</dd>
            </div>
            <div className="row">
              <dt>{t(lang, "discount")}</dt>
              <dd>−{money(applied)}</dd>
            </div>
            <div className="row total">
              <dt>{t(lang, "total")}</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          {payErr ? <p className="msg err">{payErr}</p> : null}
          <button type="button" className="btn bg-brand pay-desktop" onClick={pay} disabled={paying}>
            {paying ? "…" : `${t(lang, "pay")} · ${money(total)}`}
          </button>
        </aside>
      </div>

      <div className="pay-mobile">
        {payErr ? (
          <p className="msg err" style={{ margin: "0 0 8px" }}>
            {payErr}
          </p>
        ) : null}
        <button
          type="button"
          className="btn bg-brand"
          style={{ width: "100%", height: 48, borderRadius: 999, border: "none", fontWeight: 800 }}
          onClick={pay}
          disabled={paying}
        >
          {paying ? "…" : `${t(lang, "pay")} · ${money(total)}`}
        </button>
      </div>
      <div className="spacer-mobile" />

      <div
        className={`modal-backdrop${qrOpen ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}
      >
        <div className="modal">
          <h3>{t(lang, "qrTitle")}</h3>
          <p>{t(lang, "qrBody")}</p>
          {qrSrc ? (
            <div style={{ margin: "16px auto 0", width: 200, textAlign: "center" }}>
              <img src={qrSrc} alt="KHQR" style={{ width: "100%", borderRadius: 12 }} />
            </div>
          ) : null}
          <div className="modal-amount">{money(orderTotal || total)}</div>
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={() => setQrOpen(false)}>
              {t(lang, "cancel")}
            </button>
            <button type="button" className="bg-brand" disabled={paying} onClick={confirmQr}>
              {paying ? "…" : t(lang, "confirmPay")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
