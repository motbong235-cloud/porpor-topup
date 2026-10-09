import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { games } from "../data/catalog";
import { t } from "../lib/i18n";
import { applyCoupon, lookupNickname, money } from "../lib/store";
import { GameTile, Icon } from "../components/Icons";

export default function Game({ lang, wallet, setWallet, addOrder, settings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = games.find((g) => g.id === id);
  const closed = settings?.closedGames?.includes(id);
  const game = base ? { ...base, open: base.open && !closed } : null;

  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [server, setServer] = useState("");
  const [nick, setNick] = useState("");
  const [checkedFor, setCheckedFor] = useState("");
  const [checking, setChecking] = useState(false);
  const [packId, setPackId] = useState(null);
  const [qty, setQty] = useState(1);
  const [cat, setCat] = useState("all");
  const [method, setMethod] = useState("khqr");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [couponMsg, setCouponMsg] = useState({ type: "", text: "" });
  const [payErr, setPayErr] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [liveQr, setLiveQr] = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);
  const [paying, setPaying] = useState(false);

  const cats = useMemo(() => {
    if (!game) return ["all"];
    return ["all", ...Array.from(new Set(game.packs.map((p) => p.category)))];
  }, [game]);

  const pack = game?.packs.find((p) => p.id === packId) || null;
  const sub = pack ? Math.round(pack.price * qty * 100) / 100 : 0;
  const total = Math.max(0, Math.round((sub - applied) * 100) / 100);

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
            <div className="region">{game.region}</div>
            <h1>{game.name}</h1>
            <p className="blurb">{lang === "km" ? game.blurbKm : game.blurbEn}</p>
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
    setChecking(true);
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
        if (data.result === "valid" && data.nickname) {
          setNick(data.nickname);
          setCheckedFor(`${userId.trim()}|${zoneId.trim()}|${server}`);
        } else if (data.result === "invalid") {
          setNick("");
          setCheckedFor("");
        } else {
          // unknown / local fallback already returns nickname
          const n = data.nickname || lookupNickname(userId);
          setNick(n);
          setCheckedFor(`${userId.trim()}|${zoneId.trim()}|${server}`);
        }
      })
      .catch(() => {
        const n = lookupNickname(userId);
        setNick(n);
        setCheckedFor(`${userId.trim()}|${zoneId.trim()}|${server}`);
      })
      .finally(() => setChecking(false));
  }

  function onCoupon() {
    const res = applyCoupon(coupon, sub || 1);
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
    if (!nick || checkedFor !== `${userId.trim()}|${zoneId.trim()}|  async function place(payMethod) {
    const p = currentPack();
    if (!p) return;
    const { total } = totals();
    setPayErr("");
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          gameName: game.name,
          packId: p.id,
          packName: lang === "km" ? p.nameKm : p.name,
          qty,
          total,
          discount: applied,
          userId: userId.trim(),
          zoneId: zoneId.trim(),
          server,
          nickname: nick,
          method: payMethod,
          coupon: appliedCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayErr(data.error || "Checkout failed");
        return;
      }
      const order = data.order;
      addOrder(order);

      if (payMethod === "wallet") {
        setWallet(Math.max(0, Math.round((wallet - total) * 100) / 100));
        navigate(`/track?code=${encodeURIComponent(order.id)}`);
        return;
      }

      // KHQR
      if (data.payment?.mode === "live" && data.payment.qrImage) {
        setLiveQr(data.payment.qrImage);
        setCheckoutId(order.id);
        setQrOpen(true);
        return;
      }
      // simulation
      setLiveQr(null);
      setCheckoutId(order.id);
      setQrOpen(true);
    } catch (e) {
      setPayErr(e.message || "Network error");
    }
  }

  function pay() {
    const msg = validate();
    setPayErr(msg);
    if (msg) return;
    place(method);
  }

 {
    const msg = validate();
    setPayErr(msg);
    if (msg) return;
    if (method === "khqr") setQrOpen(true);
    else place("wallet");
  }

  const qrCells = useMemo(() => {
    const seed = `${userId}-${total}`;
    return Array.from({ length: 121 }, (_, i) => {
      let h = i * 17;
      for (const c of seed) h = (h * 33 + c.charCodeAt(0) + i) >>> 0;
      return h % 3 !== 0;
    });
  }, [userId, total, qrOpen]);

  const statusText = checking
    ? t(lang, "checking")
    : nick
      ? `${t(lang, "verified")}: ${nick}`
      : userId.trim().length > 0 && userId.trim().length < 3
        ? t(lang, "shortId")
        : t(lang, "notChecked");

  return (
    <div className="container">
      <nav className="crumb">
        <Link to="/">{t(lang, "home")}</Link> · <span>{game.name}</span>
      </nav>
      <div className="hero-game">
        <GameTile game={game} />
        <div>
          <div className="region">{game.region}</div>
          <h1>{game.name}</h1>
          <p className="blurb">{lang === "km" ? game.blurbKm : game.blurbEn}</p>
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
            <p className="hint">{lang === "km" ? game.idHintKm : game.idHintEn}</p>
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
                      <option key={s} value={s}>
                        {s}
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
                      const res = applyCoupon(coupon || appliedCode, nextSub || 1);
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
            <p className="hint">{t(lang, "payHint")}</p>
            <div className="pay-choices">
              <button
                type="button"
                className={`pay-choice${method === "wallet" ? " active" : ""}`}
                onClick={() => setMethod("wallet")}
              >
                <span style={{ color: "var(--primary)" }}>
                  <Icon name="package" />
                </span>
                <span>
                  <strong>{t(lang, "wallet")}</strong>
                  <span>
                    {t(lang, "walletHint")} · {money(wallet)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`pay-choice${method === "khqr" ? " active" : ""}`}
                onClick={() => setMethod("khqr")}
              >
                <span style={{ color: "var(--primary)" }}>
                  <Icon name="badge" />
                </span>
                <span>
                  <strong>{t(lang, "khqr")}</strong>
                  <span>{t(lang, "khqrHint")}</span>
                </span>
              </button>
            </div>
            <button type="button" className="btn-soft" style={{ marginTop: 12 }} onClick={() => setWalletOpen(true)}>
              {t(lang, "topupBal")}
            </button>
            <div className="coupon-row">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder={`${t(lang, "coupon")} · PORPOR10 / BLUE`} />
              <button type="button" onClick={onCoupon}>
                {t(lang, "apply")}
              </button>
            </div>
            {couponMsg.text ? <p className={`msg ${couponMsg.type}`}>{couponMsg.text}</p> : null}
            <p className="msg muted">{t(lang, "demoPay")}</p>
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
          <button type="button" className="btn bg-brand pay-desktop" onClick={pay}>
            {t(lang, "pay")} · {money(total)}
          </button>
        </aside>
      </div>

      <div className="pay-mobile">
        {payErr ? <p className="msg err" style={{ margin: "0 0 8px" }}>{payErr}</p> : null}
        <button type="button" className="btn bg-brand" style={{ width: "100%", height: 48, borderRadius: 999, border: "none", fontWeight: 800 }} onClick={pay}>
          {t(lang, "pay")} · {money(total)}
        </button>
      </div>
      <div className="spacer-mobile" />

      <div className={`modal-backdrop${qrOpen ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}>
        <div className="modal">
          <h3>{t(lang, "qrTitle")}</h3>
          <p>{t(lang, "qrBody")}</p>
          {liveQr ? (
            <div style={{ margin: "16px auto 0", width: 200, textAlign: "center" }}>
              <img src={liveQr.startsWith("data:") || liveQr.startsWith("http") ? liveQr : `data:image/png;base64,${liveQr}`} alt="KHQR" style={{ width: "100%", borderRadius: 12 }} />
            </div>
          ) : (
          <div className="qr-grid">
            {qrCells.map((on, i) => (
              <span key={i} className={`qr-cell${on ? " on" : ""}`} />
            ))}
          </div>
          )}
          <div className="modal-amount">{money(total)}</div>
          <div className="modal-actions">
            <button type="button" className="cancel" onClick={() => setQrOpen(false)}>
              {t(lang, "cancel")}
            </button>
            <button
              type="button"
              className="bg-brand"
              disabled={paying}
              onClick={async () => {
                if (!checkoutId) return;
                setPaying(true);
                try {
                  if (liveQr) {
                    // live: poll status once
                    const r = await fetch(`/api/checkout/${checkoutId}/status`);
                    const d = await r.json();
                    if (d.order && d.order.status !== "pending") {
                      setQrOpen(false);
                      navigate(`/track?code=${encodeURIComponent(checkoutId)}`);
                      return;
                    }
                    setPayErr(lang === "km" ? "មិនទាន់ទទួលការបង់" : "Payment not received yet");
                  } else {
                    const r = await fetch(`/api/checkout/${checkoutId}/demo-confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                    const d = await r.json();
                    setQrOpen(false);
                    navigate(`/track?code=${encodeURIComponent(checkoutId)}`);
                  }
                } catch (e) {
                  setPayErr(e.message);
                } finally {
                  setPaying(false);
                }
              }}
            >
              {paying ? "…" : t(lang, "confirmPay")}
            </button>
          </div>
        </div>
      </div>

      <div className={`modal-backdrop${walletOpen ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setWalletOpen(false)}>
        <div className="modal">
          <h3>{t(lang, "topupBal")}</h3>
          <p>
            {t(lang, "balance")}: <strong>{money(wallet)}</strong>
          </p>
          <div className="wallet-grid">
            {[5, 10, 20, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setWallet(Math.round((wallet + n) * 100) / 100);
                  setWalletOpen(false);
                }}
              >
                +{money(n)}
              </button>
            ))}
          </div>
          <p className="msg muted" style={{ marginTop: 12 }}>
            {t(lang, "demoPay")}
          </p>
        </div>
      </div>
    </div>
  );
}
