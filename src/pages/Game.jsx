import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCatalog } from "../lib/catalog";
import { t } from "../lib/i18n";
import { applyCoupon, money } from "../lib/store";
import { GameTile, Icon } from "../components/Icons";


function readCsrfCookie() {
  const m = document.cookie.match(/(?:^|; )porpor_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}
async function ensureCsrf() {
  let t = readCsrfCookie();
  if (t) return t;
  try {
    const r = await fetch("/api/csrf", { credentials: "include" });
    const d = await r.json();
    return d.csrf || readCsrfCookie();
  } catch {
    return readCsrfCookie();
  }
}


const catLabel = (c) => (String(c || "").trim().toLowerCase() === "gift card" ? "Roblox" : c);


/* ---- default banner art: unique per service (seeded by its id), used when no banner is uploaded ---- */
const ART_HUES = [212, 262, 330, 8, 30, 160, 190, 238, 285, 350];
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DefaultBannerArt({ game }) {
  const key = String(game.id || game.name || "x");
  const h = hashStr(key);
  const r = rng(h);
  const hue = ART_HUES[h % ART_HUES.length];
  const hue2 = (hue + 28 + Math.floor(r() * 30)) % 360;
  const style = (h >>> 4) % 5;
  const uid = `art${h.toString(36)}`;
  const W = 1600;
  const H = 500;
  const mark = String(game.mark || game.name || "?").slice(0, 3).toUpperCase();
  const shapes = [];

  if (style === 0) {
    // soft orbs
    for (let i = 0; i < 5; i++) {
      const cx = Math.round(r() * W);
      const cy = Math.round(r() * H);
      const rad = 140 + Math.round(r() * 220);
      shapes.push(<circle key={i} cx={cx} cy={cy} r={rad} fill={`url(#${uid}o)`} opacity={0.35 + r() * 0.35} />);
    }
  } else if (style === 1) {
    // diagonal stripes
    const gap = 46 + Math.round(r() * 30);
    const w = 14 + Math.round(r() * 14);
    for (let x = -H; x < W + H; x += gap) {
      shapes.push(<rect key={x} x={x} y={-100} width={w} height={H + 200} fill="#fff" opacity={0.07 + r() * 0.06} transform={`rotate(24 ${x} 0)`} />);
    }
    shapes.push(<circle key="c" cx={W * (0.7 + r() * 0.2)} cy={H * 0.45} r={190} fill={`url(#${uid}o)`} opacity="0.55" />);
  } else if (style === 2) {
    // concentric rings
    const cx = W * (0.62 + r() * 0.3);
    const cy = H * (0.2 + r() * 0.6);
    for (let i = 1; i <= 7; i++) {
      shapes.push(<circle key={i} cx={cx} cy={cy} r={i * 62} fill="none" stroke="#fff" strokeWidth={i % 2 ? 3 : 8} opacity={0.18 - i * 0.015} />);
    }
    shapes.push(<circle key="f" cx={cx} cy={cy} r={110} fill={`url(#${uid}o)`} opacity="0.7" />);
  } else if (style === 3) {
    // dot grid + big disc
    const step = 34;
    for (let x = step / 2; x < W; x += step) {
      for (let y = step / 2; y < H; y += step) {
        const d = Math.hypot(x - W * 0.78, y - H * 0.5) / 700;
        shapes.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={Math.max(0, 5 - d * 5)} fill="#fff" opacity="0.28" />);
      }
    }
    shapes.push(<circle key="d" cx={W * 0.82} cy={H * 0.5} r={170 + r() * 50} fill={`url(#${uid}o)`} opacity="0.6" />);
  } else {
    // layered waves
    for (let i = 0; i < 4; i++) {
      const y = H * (0.45 + i * 0.16);
      const a = 30 + r() * 40;
      const d = `M0 ${y} C ${W * 0.25} ${y - a}, ${W * 0.45} ${y + a}, ${W * 0.65} ${y} S ${W * 0.9} ${y - a}, ${W} ${y} V ${H} H 0 Z`;
      shapes.push(<path key={i} d={d} fill="#fff" opacity={0.06 + i * 0.04} />);
    }
    shapes.push(<circle key="s" cx={W * (0.15 + r() * 0.2)} cy={H * 0.28} r={80} fill={`url(#${uid}o)`} opacity="0.8" />);
  }

  return (
    <svg className="svc-hero-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 72% 16%)`} />
          <stop offset="1" stopColor={`hsl(${hue2} 70% 34%)`} />
        </linearGradient>
        <radialGradient id={`${uid}o`}>
          <stop offset="0" stopColor={`hsl(${hue2} 95% 66%)`} />
          <stop offset="1" stopColor={`hsl(${hue2} 95% 66%)`} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}g)`} />
      {shapes}
      <text x={W - 40} y={H - 30} textAnchor="end" fontSize="360" fontWeight="900" fill="#fff" opacity="0.09" fontFamily="system-ui, sans-serif">
        {mark}
      </text>
    </svg>
  );
}

function ServiceHero({ game, lang, children }) {
  const blurb = lang === "km" ? game.blurbKm : game.blurbEn;
  const [bad, setBad] = useState(() => new Set());
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  const all = Array.isArray(game.banners) && game.banners.length ? game.banners : game.banner ? [game.banner] : [];
  const imgs = all.filter((u) => !bad.has(u)).slice(0, 5);
  const n = imgs.length;
  const cur = n ? idx % n : 0;
  const go = (d) => setIdx((i) => (n ? (i + d + n) % n : 0));

  useEffect(() => {
    if (n < 2 || paused) return undefined;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const tm = setInterval(() => setIdx((i) => (i + 1) % n), 5000);
    return () => clearInterval(tm);
  }, [n, paused]);

  return (
    <div className="svc-top-stack" style={{ "--hue": game.hue || 210 }}>
      {/* Promo banner strip (package page) — like Dino */}
      {n > 0 ? (
        <div
          className="svc-promo-banner"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null || n < 2) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          {imgs.map((u, i) => (
            <img
              key={u}
              className={`svc-promo-img${i === cur ? " on" : ""}`}
              src={u}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              aria-hidden={i === cur ? undefined : true}
              onError={() => setBad((b) => new Set(b).add(u))}
            />
          ))}
          {n > 1 ? (
            <div className="svc-dots" role="tablist" aria-label="Banner">
              {imgs.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  role="tab"
                  aria-selected={i === cur}
                  aria-label={`Banner ${i + 1}`}
                  className={`svc-dot${i === cur ? " on" : ""}`}
                  onClick={() => setIdx(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <header className={`svc-hero${n ? " below-banner" : " has-art"}`}>
        {n === 0 ? <DefaultBannerArt game={game} /> : null}
        {n === 0 ? <div className="svc-hero-shade" aria-hidden /> : null}
        <div className="svc-hero-body">
          <GameTile game={game} />
          <div className="svc-hero-text">
            {game.region ? <span className="svc-region">{game.region}</span> : null}
            <h1>{game.name}</h1>
            {blurb ? <p className="svc-blurb">{blurb}</p> : null}
            {children}
          </div>
        </div>
      </header>
    </div>
  );
}

export default function Game({ lang, addOrder, settings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, loading } = useCatalog();
  const game = games.find((g) => g.id === id) || null;
  const isGift = !!(game && ["stock", "live_chat", "robux_send", "gift_code"].includes(game.deliveryType));
  const isStock = !!(game && (game.deliveryType === "stock" || game.deliveryType === "gift_code"));
  const [showSafetyGuide, setShowSafetyGuide] = useState(false);

  const safetyGuide = game?.safetyGuide;
  const safetyOn =
    !!(game && (game.deliveryType === "live_chat" || game.deliveryType === "robux_send") && safetyGuide && safetyGuide.enabled);
  const safetySteps =
    lang === "km"
      ? safetyGuide?.stepsKm || []
      : safetyGuide?.stepsEn || safetyGuide?.stepsKm || [];

  // live_chat defaults to requiring username (like auto topup); stock defaults off unless admin sets it
  const needUsername = isGift
    ? typeof game?.requireUsername === "boolean"
      ? game.requireUsername
      : game?.deliveryType === "live_chat" || game?.deliveryType === "robux_send" || game?.deliveryType === "gift_code"
    : true;

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
  const [qrExpiresAt, setQrExpiresAt] = useState(0);
  const [payDeeplink, setPayDeeplink] = useState("");
  const [payPhase, setPayPhase] = useState("qr"); // qr | scanned
  const [payLeft, setPayLeft] = useState(3600); // 1 hour
  const [checkoutId, setCheckoutId] = useState(null);
  const [paying, setPaying] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [unverified, setUnverified] = useState(false);

  useEffect(() => {
    if (!safetyOn) {
      setShowSafetyGuide(false);
      return;
    }
    setShowSafetyGuide(true);
  }, [game?.id, safetyOn]);

  const cats = useMemo(() => {
    if (!game) return ["all"];
    return ["all", ...Array.from(new Set(game.packs.map((p) => catLabel(p.category))))];
  }, [game]);

  const pack = game?.packs.find((p) => p.id === packId) || null;
  const sub = pack ? Math.round(pack.price * qty * 100) / 100 : 0;
  const total = Math.max(0, Math.round((sub - applied) * 100) / 100);

  // get the CSRF token ready now, so pressing "pay" doesn't wait for an extra round-trip
  useEffect(() => {
    ensureCsrf();
  }, []);

  // auto-check payment while the QR is open
  useEffect(() => {
    if (!qrOpen || !checkoutId) return undefined;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/checkout/${checkoutId}/status`);
        const d = await r.json();
        if (d.order && d.order.status !== "pending") {
          setQrOpen(false);
          navigate(`/success?code=${encodeURIComponent(checkoutId)}`);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [qrOpen, checkoutId, navigate]);

  useEffect(() => {
    if (!qrOpen) return undefined;
    // 1 hour default; if API gave expiresAt, count down to that
    const fromApi = qrExpiresAt > Date.now() ? Math.floor((qrExpiresAt - Date.now()) / 1000) : 0;
    setPayLeft(Math.max(3600, fromApi > 0 ? fromApi : 3600)); // always show ≥ 1 hour
    const tmr = setInterval(() => {
      setPayLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(tmr);
  }, [qrOpen, checkoutId, qrExpiresAt]);

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
        <ServiceHero game={game} lang={lang} />
        <div className="card" style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ fontWeight: 600 }}>{t(lang, "maintenance")} — {t(lang, "unavailable")}</p>
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
          setNick(data.nickname || "OK");
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

  async function onCoupon() {
    const code = String(coupon || "").trim();
    if (!code) {
      setApplied(0);
      setAppliedCode("");
      setCouponMsg({ type: "", text: "" });
      return;
    }
    try {
      const res = await fetch("/api/coupon/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: sub || 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setApplied(0);
        setAppliedCode("");
        setCouponMsg({ type: "err", text: data.error === "min" ? t(lang, "couponMin") : t(lang, "couponBad") });
        return;
      }
      setApplied(sub ? Number(data.discount) || 0 : 0);
      setAppliedCode(data.code || code.toUpperCase());
      setCouponMsg({ type: data.code ? "ok" : "", text: data.code ? t(lang, "couponOk") : "" });
    } catch {
      setApplied(0);
      setAppliedCode("");
      setCouponMsg({ type: "err", text: t(lang, "couponBad") });
    }
  }

  function validate() {
    if (!packId) return t(lang, "needPack");
    if (isGift) {
      if (needUsername && userId.trim().length < 3) {
        return lang === "km" ? "សូមបញ្ចូល Username" : "Please enter username";
      }
      return "";
    }
    if (userId.trim().length < 3) return t(lang, "needId");
    if (game.hasZone && !zoneId.trim()) return t(lang, "needZone");
    if (game.servers?.length && !server) return t(lang, "needServer");
    if (checkedFor !== `${userId.trim()}|${zoneId.trim()}|${server}`) return t(lang, "needVerify");
    return "";
  }

  const ERRORS = {
    maintenance: { km: "ហាងកំពុងថែទាំ សូមព្យាយាមម្តងទៀតពេលក្រោយ", en: "The shop is under maintenance. Try again later." },
    not_configured: { km: "ការទូទាត់មិនទាន់រួចរាល់ សូមទាក់ទងអ្នកគ្រប់គ្រង", en: "Payments are not set up yet. Please contact support." },
    out_of_stock: { km: "អស់ស្តុកហើយ — សូមជ្រើស pack ផ្សេង ឬរង់ចាំ Admin ដាក់ស្តុក", en: "Out of stock — pick another pack or wait for restock" },
      qr_failed: { km: "មិនអាចបង្កើត QR បង់ប្រាក់បានទេ សូមទាក់ទងអ្នកគ្រប់គ្រងហាង", en: "Could not create the payment QR. Please contact the shop." },
    pack_unavailable: { km: "កញ្ចប់នេះមិនមានលក់ទៀតទេ សូមជ្រើសកញ្ចប់ផ្សេង", en: "This package is no longer available." },
    coupon_invalid: { km: "កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ", en: "Invalid coupon code." },
    coupon_min: { km: "ចំនួនទិញមិនដល់កម្រិតអប្បបរមានៃកូដនេះ", en: "Order is below this coupon's minimum." },
    server_error: { km: "មានបញ្ហាម៉ាស៊ីនបម្រើ សូមព្យាយាមម្តងទៀត", en: "Server error. Please try again." },
    invalid: { km: "ព័ត៌មានមិនគ្រប់គ្រាន់ សូមពិនិត្យ ID ហើយព្យាយាមម្តងទៀត", en: "Missing or invalid details. Check your ID and try again." },
    need_zone: { km: "សូមបញ្ចូល Zone ID", en: "Please enter the Zone ID." },
    need_server: { km: "សូមជ្រើសរើស Server", en: "Please choose a server." },
    catalog_unavailable: { km: "មិនអាចទាញតម្លៃបានទេ សូមព្យាយាមម្តងទៀត", en: "Could not load prices. Try again." },
  };

  async function place() {
    const p = pack;
    if (!p) return;
    setPayErr("");
    setPaying(true);
    try {
      const csrf = await ensureCsrf();
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          gameId: game.id,
          packId: p.id,
          qty,
          userId: isGift ? (needUsername ? userId.trim() : "gift") : userId.trim(),
          zoneId: zoneId.trim(),
          server,
          nickname: nick,
          coupon: appliedCode,
          idempotencyKey: `pp-${game.id}-${p.id}-${qty}-${isGift ? (needUsername ? userId.trim() : "gift") : userId.trim()}-${zoneId.trim()}-${Math.floor(Date.now() / 120000)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const known = ERRORS[data.error];
        setPayErr(known ? known[lang] : (lang === "km" ? "បង់ប្រាក់មិនបាន សូមព្យាយាមម្តងទៀត" : "Checkout failed. Please try again.") + (data.error ? ` (${data.error})` : ""));
        return;
      }
      if (!data.payment?.qrImage) {
        setPayErr(ERRORS.not_configured[lang]);
        return;
      }
      addOrder(data.order);
      setOrderTotal(data.order.total);
      setLiveQr(data.payment.qrImage);
      {
        const expRaw = data.payment.expiresAt;
        let expMs = 0;
        if (expRaw) {
          const n = Date.parse(expRaw) || Number(expRaw) || 0;
          expMs = n < 1e12 ? n * 1000 : n; // sec vs ms
        }
        if (!expMs || expMs < Date.now() + 3600_000) expMs = Date.now() + 3600_000; // min 1 hour
        setQrExpiresAt(expMs);
      }
      setPayDeeplink(data.payment.openAbaUrl || data.payment.deeplink || data.payment.payUrl || "");
      setPayPhase("qr");
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
        navigate(`/success?code=${encodeURIComponent(checkoutId)}`);
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
      <ServiceHero game={game} lang={lang}>
        <div className="chips">
          <span className="chip chip-icon"><Icon name="zap" size={14} /> {t(lang, "statSpeed")}</span>
          <span className="chip chip-icon"><Icon name="qr" size={14} /> KHQR</span>
          <span className="chip chip-icon"><Icon name="shield" size={14} /> Secure</span>
        </div>
      </ServiceHero>

      <div className="layout-2">
        <div style={{ display: "grid", gap: 24 }}>
          {/* Full account form for Khmer TopUp games */}

          {showSafetyGuide && safetyOn ? (
            <div className="safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title">
              <div className="safety-modal-backdrop" onClick={() => setShowSafetyGuide(false)} />
              <div className="safety-modal-card">
                <div className="safety-modal-icon" aria-hidden>
                  <Icon name="shield" size={28} />
                </div>
                <h2 id="safety-title">
                  {lang === "km"
                    ? safetyGuide?.titleKm || "សូមអានមុនបន្ត"
                    : safetyGuide?.titleEn || "Please read before continuing"}
                </h2>
                <p className="safety-modal-lead">
                  {lang === "km"
                    ? "សូមអនុវត្តតាមជំហានខាងក្រោមដើម្បីសុវត្ថិភាពគណនី"
                    : "Follow the steps below to keep your account safe"}
                </p>
                <ol className="safety-steps">
                  {(safetySteps.length
                    ? safetySteps
                    : lang === "km"
                      ? [
                          "បើក Settings ក្នុង Roblox → បិទ Select / Unselect និង Kid",
                          "កុំផ្តល់ Password ឲ្យអ្នកណា — Admin មិនសុំ Password",
                          "បង់រួចផ្ញើ Order ID តាម Live Chat ដើម្បីទទួលសេវា",
                        ]
                      : [
                          "Open Roblox Settings → turn off Select / Unselect and Kid",
                          "Never share your password — Admin will never ask for it",
                          "After payment, send Order ID via Live Chat for delivery",
                        ]
                  ).map((step, i) => (
                    <li key={i}>
                      <span className="safety-step-num">{i + 1}</span>
                      <span className="safety-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="btn-primary safety-modal-btn"
                  onClick={() => setShowSafetyGuide(false)}
                >
                  {lang === "km" ? "យល់ព្រម · បន្ត" : "Got it · Continue"}
                </button>
              </div>
            </div>
          ) : null}

          {!isGift && (
          <section className="card">
            <h2 className="sec-title"><span className="step-no">1</span> {t(lang, "account")}</h2>
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
          )}

          {/* Manual / Live Chat service — premium Enter Information card */}
          {isGift && ((game.deliveryType === "live_chat" || game.deliveryType === "robux_send")) ? (
            <section className="card enter-info-card">
              <div className="enter-info-head">
                <span className="enter-info-ico" aria-hidden><Icon name="shield" size={16} /></span>
                <h2 className="sec-title">{lang === "km" ? "បញ្ចូលព័ត៌មាន" : "Enter Information"}</h2>
              </div>
              {needUsername ? (
                <label className="field enter-info-field">
                  <span className="enter-info-label">Username</span>
                  <input
                    value={userId}
                    inputMode="text"
                    placeholder={lang === "km" ? "បញ្ចូល Username (ឧ. @user123)" : "Enter Username (e.g. @user123)"}
                    autoComplete="username"
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </label>
              ) : null}
              <div className="enter-info-note">
                <span className="enter-info-note-tag">{lang === "km" ? "កំណត់សម្គាល់" : "Note"}</span>
                <p>
                  {lang === "km"
                    ? (game.idHintKm ||
                        "យើងខ្ញុំមិនទាមទារ Password គណនីរបស់អ្នកឡើយ។ បន្ទាប់ពីទូទាត់ប្រាក់រួច លោកអ្នកនឹងទទួលបាន Order ID មួយ។ សូមផ្ញើលេខ Order ID នោះមកកាន់ក្រុមការងារយើងខ្ញុំតាម Live Chat ដើម្បីឱ្យយើងរៀបចំបញ្ចូល Robux ជូនលោកអ្នកភ្លាមៗ។")
                    : (game.idHintEn ||
                        "We never ask for your account password. After payment you get an Order ID — send it via Live Chat so our team can deliver for you.")}
                </p>
              </div>
            </section>
          ) : null}

          {/* Stock / gift auto — username only if required, no manual Live Chat note */}
          {isGift && isStock && needUsername ? (
            <section className="card">
              <h2 className="sec-title"><span className="step-no">1</span> {t(lang, "account")}</h2>
              <div className="form-grid">
                <label className="field">
                  Username
                  <input
                    value={userId}
                    inputMode="text"
                    placeholder={lang === "km" ? "ឧ. PlayerName" : "e.g. PlayerName"}
                    autoComplete="username"
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </label>
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="pack-head">
              <h2 className="sec-title"><span className="step-no">2</span> {t(lang, "packs")}</h2>
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
            {cats.length > 2 ? (
            <div className="cats">
              {cats.map((c) => (
                <button key={c} type="button" className={`cat${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>
                  {c === "all" ? t(lang, "allCats") : c}
                </button>
              ))}
            </div>
            ) : null}
            <div className="packs">
              {game.packs
                .filter((p) => cat === "all" || catLabel(p.category) === cat)
                .map((p) => {
                  const soldOut = isStock && p.inStock === false;
                  return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={soldOut}
                    aria-pressed={packId === p.id}
                    className={`pack${p.image ? " has-img" : ""}${packId === p.id ? " active" : ""}${soldOut ? " sold-out" : ""}`}
                    onClick={() => {
                      if (soldOut) return;
                      setPackId(p.id);
                      const nextSub = Math.round(p.price * qty * 100) / 100;
                      const codeTry = String(coupon || appliedCode || "").trim();
                      if (codeTry) {
                        fetch("/api/coupon/preview", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code: codeTry, subtotal: nextSub || 1 }),
                        })
                          .then((r) => r.json())
                          .then((data) => {
                            if (data?.ok && data.code) {
                              setApplied(nextSub ? Number(data.discount) || 0 : 0);
                              setAppliedCode(data.code);
                            } else setApplied(0);
                          })
                          .catch(() => setApplied(0));
                      } else setApplied(0);
                    }}
                  >
                    {p.image ? (
                      <img
                        className="pack-img"
                        src={p.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    {packId === p.id ? (
                      <span className="pack-tick" aria-hidden><Icon name="check" size={12} /></span>
                    ) : null}
                    <div className="pack-body">
                      <div className="cat-label">{catLabel(p.category)}</div>
                      <div className="name">{lang === "km" ? p.nameKm : p.name}</div>
                      {p.bonus ? <div className="bonus">{p.bonus}</div> : null}
                      <div className="price">{money(p.price)}{p.resellerPrice ? " · Reseller" : ""}</div>
                      {isStock ? (
                        <div className="bonus" style={{ opacity: soldOut ? 1 : 0.8 }}>
                          {soldOut
                            ? (lang === "km" ? "អស់ស្តុក" : "Out of stock")
                            : (lang === "km" ? `នៅសល់ ${p.stock ?? "—"}` : `Stock ${p.stock ?? "—"}`)}
                        </div>
                      ) : null}
                    </div>
                  </button>
                  );
                })}
            </div>
          </section>

          
          {isGift && isStock ? (
            <section className="card delivery-card stock">
              <div className="delivery-head">
                <span className="delivery-ico" aria-hidden><Icon name="zap" size={20} /></span>
                <h2>{lang === "km" ? "ទទួលកូដស្វ័យប្រវត្តិ" : "Instant code from stock"}</h2>
              </div>
              <p className="hint">
                {lang === "km"
                  ? "បង់រួចកូដបង្ហាញភ្លាមលើ Payment Successful។ អស់ស្តុក មាន Live Chat។"
                  : "After pay, code shows on Payment Successful. Out of stock → Live Chat."}
              </p>
            </section>
          ) : null}

<section className="card pay-section">
            <h2 className="sec-title"><span className="step-no">3</span> {t(lang, "payment")}</h2>
            <div className="pay-choices">
              <div className="pay-choice active" role="radio" aria-checked="true">
                <div className="pay-choice-brand">
                  <img
                    className="pay-aba-mark"
                    src={"/aba-logo.svg?v=4"}
                    alt="ABA"
                    width={88}
                    height={32}
                    decoding="async"
                  />
                </div>
                <div className="pay-choice-meta">
                  <strong>ABA KHQR</strong>
                  <span>{t(lang, "khqrHint")}</span>
                </div>
                <span className="pay-choice-check" aria-hidden>
                  <Icon name="check" size={14} />
                </span>
              </div>
            </div>
            <div className="coupon-row">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder={t(lang, "coupon")} />
              <button type="button" onClick={onCoupon} className="coupon-apply">
                <Icon name="tag" size={16} /> {t(lang, "apply")}
              </button>
            </div>
            {couponMsg.text ? <p className={`msg ${couponMsg.type}`}>{couponMsg.text}</p> : null}
          </section>
        </div>

        <aside className="card summary">
          <h2 className="sec-title"><Icon name="cart" size={18} /> {t(lang, "summary")}</h2>
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
        <div className="pay-mobile-sel">
          <span>{pack ? (lang === "km" ? pack.nameKm : pack.name) : (lang === "km" ? "សូមជ្រើសកញ្ចប់" : "Select a package")}</span>
          {pack ? <b>×{qty}</b> : null}
        </div>
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
        className={`pw-sheet-bg${qrOpen ? " open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}
      >
        <div className="pw-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="pw-handle" />
          <div className="pw-brand">
            <img className="pw-aba-img" src={"/aba-logo.svg?v=4"} alt="ABA" />
            <div className="pw-brand-col">
              <span className="pw-brand-text">ABA PAYWAY</span>
              <span className="pw-brand-sub">KHQR · Secure</span>
            </div>
          </div>

          {payPhase === "qr" ? (
            <>
              <div className="pw-amount">{money(orderTotal || total)}</div>
              <p className="pw-hint">
                {lang === "km"
                  ? "ស្កេន QR ដោយ app ធនាគារ ឬបើក ABA Mobile"
                  : "Scan with any bank app or open ABA Mobile"}
              </p>
              {qrSrc ? (
                <div className="pw-qr-wrap">
                  <img src={qrSrc} alt="KHQR" className="pw-qr" />
                </div>
              ) : null}
              <div className="pw-timer">
                {payLeft > 0 ? (
                  <>
                    <span className="pw-timer-dot" />
                    {lang === "km" ? "ផុតកំណត់ក្នុង" : "Expires in"}{" "}
                    {payLeft >= 3600
                      ? `${String(Math.floor(payLeft / 3600)).padStart(2, "0")}:`
                      : ""}
                    {String(Math.floor((payLeft % 3600) / 60)).padStart(2, "0")}:
                    {String(payLeft % 60).padStart(2, "0")}
                  </>
                ) : (
                  <span style={{ color: "var(--danger)" }}>
                    {lang === "km" ? "QR ផុតកំណត់" : "QR expired"}
                  </span>
                )}
              </div>
              <p className="pw-order">Order · {checkoutId}</p>
              {payDeeplink ? (
                <button
                  type="button"
                  className="btn bg-brand pw-aba-btn"
                  onClick={() => {
                    window.location.href = payDeeplink;
                    setPayPhase("scanned");
                  }}
                >
                  {lang === "km" ? "OPEN ABA Mobile" : "OPEN ABA Mobile"}
                </button>
              ) : (
                <button type="button" className="btn bg-brand pw-aba-btn" onClick={() => setPayPhase("scanned")}>
                  {lang === "km" ? "ខ្ញុំបានស្កេនហើយ" : "I have scanned"}
                </button>
              )}
              <button type="button" className="btn btn-soft pw-secondary" disabled={paying} onClick={confirmQr}>
                {paying ? "…" : lang === "km" ? "ខ្ញុំបានបង់ហើយ" : "I have paid"}
              </button>
              <button type="button" className="pw-link" onClick={() => setQrOpen(false)}>
                {t(lang, "cancel")}
              </button>
            </>
          ) : (
            <div className="pw-scanned">
              <div className="pw-scanned-ico" aria-hidden="true">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect x="12" y="12" width="16" height="16" rx="2" stroke="#1d6adf" strokeWidth="3" />
                  <rect x="36" y="12" width="16" height="16" rx="2" stroke="#1d6adf" strokeWidth="3" />
                  <rect x="12" y="36" width="16" height="16" rx="2" stroke="#1d6adf" strokeWidth="3" />
                  <path d="M36 44h16M44 36v16" stroke="#1d6adf" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="48" cy="48" r="10" fill="#22c55e" />
                  <path d="M43 48l3 3 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="pw-scanned-title">
                {lang === "km" ? "QR បានស្កេនហើយ" : "QR code is scanned"}
              </h3>
              <p className="pw-scanned-desc">
                {lang === "km"
                  ? "សូមបញ្ជាក់ការបង់ប្រាក់ក្នុង app ABA តាមសេចក្តីណែនាំលើអេក្រង់"
                  : "Please follow in-app screen instruction."}
              </p>
              <div className="pw-waiting">
                <span className="pw-spin" />
                {lang === "km" ? "កំពុងរង់ចាំការបញ្ជាក់…" : "Waiting for confirmation…"}
              </div>
              <p className="pw-order">Order · {checkoutId}</p>
              <button type="button" className="btn btn-soft pw-secondary" disabled={paying} onClick={confirmQr}>
                {paying ? "…" : lang === "km" ? "ខ្ញុំបានបង់ហើយ" : "I have paid"}
              </button>
              <button type="button" className="pw-link" onClick={() => setPayPhase("qr")}>
                <Icon name="chevL" size={14} />
                {lang === "km" ? "មើល QR ម្ដងទៀត" : "Show QR again"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}