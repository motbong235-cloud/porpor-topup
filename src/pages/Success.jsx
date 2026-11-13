import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icons";
import { Link, useSearchParams } from "react-router-dom";
import { t } from "../lib/i18n";
import { money } from "../lib/store";
import RobuxRain from "../components/RobuxRain";

/**
 * Payment Successful page (storefront):
 * - Shows order summary
 * - Live Chat → Telegram admin with Order ID + amount prefilled
 * - Customer does not fill anything else
 */
/** YouTube video id from watch / youtu.be / shorts / live / embed links (with extra params). */
function youtubeId(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    const h = u.hostname.replace(/^(www|m|music)\./, "");
    let id = "";
    if (h === "youtu.be") id = u.pathname.split("/")[1] || "";
    else if (h === "youtube.com" || h === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,20})/);
        if (m) id = m[1];
      }
    }
    return /^[\w-]{6,20}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function isDirectVideo(u) {
  const s = String(u || "").split("?")[0].toLowerCase();
  return s.startsWith("/uploads/") || /\.(mp4|m4v|mov|webm)$/.test(s);
}

export default function Success({ lang, settings }) {
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!code);
  const [err, setErr] = useState("");
  const [gameMeta, setGameMeta] = useState(null);

  const telegram = settings?.telegram || "https://t.me/porportopup";
  const isTikTok = useMemo(() => {
    // Tutorial video + note are only for the TikTok Khmer service (not any game with "tiktok" in its name)
    return String(order?.gameId || "").toLowerCase() === "tiktok-khmer";
  }, [order]);
  const isRobux = useMemo(() => {
    const dt = String(order?.deliveryType || "");
    const name = String(order?.gameName || "").toLowerCase();
    return dt === "robux_send" || name.includes("robux");
  }, [order]);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setErr("missing");
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/orders/track?q=${encodeURIComponent(code)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          if (!alive) return;
          const o = Array.isArray(list) ? list.find((x) => x.id === code) || list[0] : null;
          setOrder(o || null);
          if (!o) setErr("not_found");
        })
        .catch(() => alive && setErr("fail"))
        .finally(() => alive && setLoading(false));
    load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [code]);

  useEffect(() => {
    if (!order?.gameId) return;
    let alive = true;
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!alive) return;
        const games = Array.isArray(list) ? list : list?.games || [];
        const g = games.find((x) => String(x.id) === String(order.gameId));
        setGameMeta(g || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [order?.gameId]);

  function openLiveChat(o) {
    const lines =
      lang === "km"
        ? [
            "សួស្តី Admin!",
            "ខ្ញុំបង់ប្រាក់រួចហើយ សុំជួយដាក់/ផ្តល់កូដផង។",
            "",
            `Order ID: ${o?.id || code}`,
            `ផលិតផល: ${o?.gameName || ""} · ${o?.packName || ""} × ${o?.qty || 1}`,
            `ចំនួនទឹកប្រាក់: $${Number(o?.total || 0).toFixed(2)}`,
          ]
        : [
            "Hi Admin!",
            "I have paid. Please deliver / send my code.",
            "",
            `Order ID: ${o?.id || code}`,
            `Product: ${o?.gameName || ""} · ${o?.packName || ""} × ${o?.qty || 1}`,
            `Amount: $${Number(o?.total || 0).toFixed(2)}`,
          ];
    const prefill = lines.filter(Boolean).join("\n");
    window.dispatchEvent(
      new CustomEvent("pp-open-livechat", {
        detail: {
          orderId: o?.id || code,
          prefill,
          name: o?.userId || o?.playerId || "",
          username: o?.userId || o?.playerId || "",
          amount: o?.total,
          item: `${o?.gameName || ""} · ${o?.packName || ""} × ${o?.qty || 1}`.trim(),
          title: "New Order",
          status: "ASSIGNED",
        },
      }),
    );
  }

  function liveChatUrl(o) {

    const baseTg = String(telegram || "").trim();
    const username = baseTg
      .replace(/^https?:\/\/(www\.)?t\.me\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0];

    const lines =
      lang === "km"
        ? [
            "សួស្តី Admin!",
            `ខ្ញុំបង់ប្រាក់រួចហើយ សុំជួយដាក់/ផ្តល់កូដផង។`,
            ``,
            `Order ID: ${o?.id || code}`,
            `ផលិតផល: ${o?.gameName || ""} · ${o?.packName || ""} × ${o?.qty || 1}`,
            `ចំនួនទឹកប្រាក់: $${Number(o?.total || 0).toFixed(2)}`,
            o?.userId && o.userId !== "gift" ? `ID: ${o.userId}${o.zoneId ? ` (${o.zoneId})` : ""}` : "",
          ]
        : [
            "Hi Admin!",
            `I have paid. Please deliver / send my code.`,
            ``,
            `Order ID: ${o?.id || code}`,
            `Product: ${o?.gameName || ""} · ${o?.packName || ""} × ${o?.qty || 1}`,
            `Amount: $${Number(o?.total || 0).toFixed(2)}`,
            o?.userId && o.userId !== "gift" ? `ID: ${o.userId}${o.zoneId ? ` (${o.zoneId})` : ""}` : "",
          ];
    const text = encodeURIComponent(lines.filter(Boolean).join("\n"));
    if (username) return `https://t.me/${username}?text=${text}`;
    return baseTg || "/support";
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(order?.id || code);
    } catch {}
  }

  if (loading) {
    return (
      <div className="container success-page">
        <p className="page-lead">{lang === "km" ? "កំពុងផ្ទុក…" : "Loading…"}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container success-page">
        <h1 className="page-title">{lang === "km" ? "រកមិនឃើញការបញ្ជាទិញ" : "Order not found"}</h1>
        <Link to="/track" className="btn bg-brand">
          {t(lang, "track")}
        </Link>
      </div>
    );
  }

  const isGift = ["stock", "live_chat", "robux_send", "gift_code"].includes(order.deliveryType);
  // Manual service = Admin delivers by hand through Live Chat (not automatic)
  const isManual = order.deliveryType === "live_chat" || order.deliveryType === "robux_send";
  const isStockAuto = order.deliveryType === "stock" || order.deliveryType === "gift_code";
  const st = String(order.status || "").toLowerCase();
  const delivered = st === "delivered" || st === "completed" || st === "done";
  const failed = st === "failed";
  const paid = order.providerPaid || order.paidAt || ["paid", "delivered", "processing", "done", "success", "completed"].includes(st);
  const showUser = order.userId && order.userId !== "gift";
  const idLabel = isTikTok
    ? lang === "km" ? "Link / Username" : "Link / Username"
    : isRobux || /roblox/i.test(String(order.gameName || ""))
      ? "Roblox Username"
      : "ID";
  const stepLabel = delivered
    ? lang === "km" ? "បានដឹកជញ្ជូនរួចរាល់" : "Delivered"
    : failed
      ? lang === "km" ? "បរាជ័យ — សូមទាក់ទង Admin" : "Failed — contact Admin"
      : isManual
        ? lang === "km" ? "បានបង់ប្រាក់ · រង់ចាំ Admin" : "Paid · waiting for Admin"
        : lang === "km" ? "បានបង់ប្រាក់ · កំពុងដំណើរការ" : "Paid · processing";
  const statusTone = failed ? "bad" : delivered ? "ok" : "wait";

  return (
    <div className="container success-page">
      <div className="success-card card">
        <div className="success-icon" aria-hidden>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 className="success-title">
          {paid
            ? lang === "km"
              ? "បង់ប្រាក់ជោគជ័យ"
              : "Payment Successful"
            : lang === "km"
              ? "រង់ចាំការបង់ប្រាក់"
              : "Awaiting payment"}
        </h1>
        <p className="success-sub">
          {paid
            ? lang === "km"
              ? "ប្រតិបត្តិការរបស់អ្នកបានបញ្ចប់ដោយជោគជ័យ។"
              : "Your transaction has been successfully completed."
            : lang === "km"
              ? "សូមបញ្ចប់ការបង់ប្រាក់ បន្ទាប់មកត្រឡប់មកទំព័រនេះវិញ។"
              : "Please complete payment, then return to this page."}
        </p>

        <div className="success-table">
          <div className="row">
            <span>{lang === "km" ? "ផលិតផល" : "Product"}</span>
            <strong>
              {order.packName} ×{order.qty}
            </strong>
          </div>
          <div className="row">
            <span>{lang === "km" ? "សរុប" : "Total"}</span>
            <strong>{money(order.total)}</strong>
          </div>
          <div className="row">
            <span>{lang === "km" ? "ហ្គេម" : "Game"}</span>
            <strong>{order.gameName}</strong>
          </div>
          {showUser && (!isGift || isManual || order.deliveryType === "stock") ? (
            <div className="row">
              <span>{idLabel}</span>
              <strong>
                {order.userId}
                {order.zoneId ? ` (${order.zoneId})` : ""}
              </strong>
            </div>
          ) : null}
          {order.nickname ? (
            <div className="row">
              <span>{lang === "km" ? "ឈ្មោះគណនី" : "Account"}</span>
              <strong>{order.nickname}</strong>
            </div>
          ) : null}
          <div className="row">
            <span>{lang === "km" ? "វិធីទូទាត់" : "Payment Method"}</span>
            <strong className="pay-method-logos">
              <img src="/aba-logo.svg" alt="ABA" height={22} />
              <img src="/khqr-logo.svg" alt="KHQR" height={22} />
            </strong>
          </div>
          <div className="row">
            <span>Order ID</span>
            <strong className="mono">
              {order.id}{" "}
              <button type="button" className="btn-soft" style={{ marginLeft: 6, padding: "2px 8px" }} onClick={copyId}>
                {t(lang, "copy")}
              </button>
            </strong>
          </div>
          <div className="row">
            <span>{lang === "km" ? "កាលបរិច្ឆេទ" : "Date"}</span>
            <strong>{new Date(order.paidAt || order.createdAt).toLocaleString(lang === "km" ? "km-KH" : "en-GB", { timeZone: "Asia/Phnom_Penh" })}</strong>
          </div>
          <div className="row">
            <span>{lang === "km" ? "ស្ថានភាព" : "Status"}</span>
            <strong className={`success-status ${statusTone}`}>
              <i aria-hidden /> {paid ? stepLabel : lang === "km" ? "រង់ចាំការបង់ប្រាក់" : "Awaiting payment"}
            </strong>
          </div>
          {order.giftCode ? (
            <div className="row">
              <span>{lang === "km" ? "កូដ" : "Code"}</span>
              <strong className="mono">{order.giftCode}</strong>
            </div>
          ) : null}
        </div>

        {order.giftCode ? (
          <div className="success-chat-box ok">
            <p>
              {lang === "km"
                ? "កូដរបស់អ្នកត្រូវបានផ្តល់ស្វ័យប្រវត្តិ (copy ខាងលើ)។ បើមានបញ្ហា ចូល Live Chat។"
                : "Your code was delivered automatically (copy above). Contact Live Chat if needed."}
            </p>
            <button type="button" className="btn success-livechat" onClick={() => openLiveChat(order)}>
              <Icon name="chat" size={17} /> Live Chat
            </button>
          </div>
        ) : isManual && !delivered ? (
          <div className="success-chat-box manual">
            <strong className="success-chat-title">
              {lang === "km" ? "ជំហានបន្ទាប់ — ចូល Live Chat" : "Next step — open Live Chat"}
            </strong>
            <p>
              {isRobux
                ? lang === "km"
                  ? "សេវានេះមិន auto ទេ។ ចុច Live Chat ដើម្បីផ្ញើ Order ID ទៅ Admin — Admin នឹងផ្ញើ Robux ឲ្យអ្នកដោយដៃ។ យើងមិនសុំ Password ទេ។"
                  : "This service is not automatic. Tap Live Chat to send your Order ID — Admin will deliver your Robux by hand. We never ask for your password."
                : lang === "km"
                  ? "សេវានេះមិន auto ទេ។ ចុច Live Chat ដើម្បីផ្ញើ Order ID ទៅ Admin ហើយ Admin នឹងដំណើរការ Order ឲ្យអ្នក។"
                  : "This service is not automatic. Tap Live Chat to send your Order ID — Admin will process your order."}
            </p>
            <button type="button" className="btn success-livechat" onClick={() => openLiveChat(order)}>
              <Icon name="chat" size={17} /> Live Chat
            </button>
            <a className="success-tg-link" href={liveChatUrl(order)} target="_blank" rel="noopener noreferrer">
              {lang === "km" ? "ឬទាក់ទងតាម Telegram" : "or message us on Telegram"} <Icon name="external" size={12} />
            </a>
          </div>
        ) : isStockAuto && !order.giftCode && !failed ? (
          <div className="success-chat-box">
            <p>
              {lang === "km"
                ? "កូដនឹងបង្ហាញនៅទីនេះស្វ័យប្រវត្តិភ្លាមៗ។ បើយូរពេក សូមចូល Live Chat។"
                : "Your code will appear here automatically. If it takes too long, open Live Chat."}
            </p>
            <button type="button" className="btn success-livechat" onClick={() => openLiveChat(order)}>
              <Icon name="chat" size={17} /> Live Chat
            </button>
          </div>
        ) : (
          <div className={`success-chat-box ${delivered ? "ok" : ""}`}>
            <p>
              {delivered
                ? lang === "km"
                  ? "Order របស់អ្នកត្រូវបានដាក់ចូលស្វ័យប្រវត្តិរួចរាល់ ✅ សូមពិនិត្យក្នុងហ្គេម។"
                  : "Your order was delivered automatically ✅ Please check in-game."
                : failed
                  ? lang === "km"
                    ? "មានបញ្ហាក្នុងការដាក់ Order សូមទាក់ទង Admin ជាមួយ Order ID ខាងលើ។"
                    : "Something went wrong delivering your order. Contact Admin with the Order ID above."
                  : lang === "km"
                    ? "កំពុងដាក់ចូលស្វ័យប្រវត្តិ ជាធម្មតាតិចជាង ១ នាទី។ ទំព័រនេះនឹងធ្វើបច្ចុប្បន្នភាពដោយខ្លួនឯង។"
                    : "Delivering automatically — usually under a minute. This page updates by itself."}
            </p>
            {delivered && !failed ? null : (
              <button type="button" className="btn success-livechat" onClick={() => openLiveChat(order)}>
                <Icon name="chat" size={17} /> Live Chat
              </button>
            )}
          </div>
        )}

        <div className="success-note">
          {lang === "km" ? "អ្នកអាចមើល Order នេះម្តងទៀតបានគ្រប់ពេលនៅ " : "You can view this order again anytime in "}
          <Link to={`/track?code=${encodeURIComponent(order.id)}`}>{lang === "km" ? "តាមដាន Order" : "Track Order"}</Link>
          {lang === "km" ? " ដោយប្រើ Order ID។" : " with your Order ID."}
        </div>

        {isRobux ? <RobuxRain count={14} /> : null}

        {isTikTok && paid ? (
          <div className="tt-tutorial">
            <h3>
              {gameMeta?.tutorialVideoTitle ||
                (lang === "km" ? "Video បង្រៀន · TikTok Khmer" : "Tutorial video · TikTok Khmer")}
            </h3>
            {gameMeta?.tutorialVideoUrl ? (
              (() => {
                const url = String(gameMeta.tutorialVideoUrl);
                const yt = youtubeId(url);
                const openLabel = lang === "km" ? "បើក Video ក្នុងផ្ទាំងថ្មី" : "Open video in a new tab";
                if (yt) {
                  return (
                    <iframe
                      title="tutorial"
                      src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                      allowFullScreen
                    />
                  );
                }
                if (isDirectVideo(url)) {
                  return (
                    <>
                      <video src={url} controls playsInline preload="metadata" />
                      <a className="tt-video-open" href={url} target="_blank" rel="noopener noreferrer">
                        <Icon name="external" size={14} /> {openLabel}
                      </a>
                    </>
                  );
                }
                // Facebook / Telegram / Drive … cannot be embedded: show a clear button instead of an empty box
                return (
                  <a className="btn bg-brand tt-video-link" href={url} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={16} /> {lang === "km" ? "មើល Video បង្រៀន" : "Watch tutorial video"}
                  </a>
                );
              })()
            ) : (
              <p className="tt-tutorial-note">
                {lang === "km"
                  ? "Admin នឹងដាក់ video បង្រៀនក្នុង Settings TikTok Khmer"
                  : "Admin can set tutorial video in TikTok Khmer settings"}
              </p>
            )}
            <div className="tt-tutorial-note">
              {(lang === "km"
                ? gameMeta?.customerNoteKm
                : gameMeta?.customerNoteEn) ||
                (lang === "km"
                  ? "អរគុណសម្រាប់ការបញ្ជាទិញ! សូមមើល video បង្រៀនខាងលើ។ បើត្រូវការជំនួយ ទាក់ទង Support។"
                  : "Thank you for your order! Watch the tutorial above. Contact support if you need help.")}
            </div>
            <a
              className="btn bg-brand tt-support-btn"
              href={
                (gameMeta?.supportContact || "https://t.me/kairozen_support").startsWith("http")
                  ? gameMeta?.supportContact || "https://t.me/kairozen_support"
                  : `https://t.me/${String(gameMeta?.supportContact || "kairozen_support").replace(/^@/, "")}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {lang === "km" ? "ទាក់ទង Support @kairozen_support" : "Contact Support @kairozen_support"}
            </a>
          </div>
        ) : null}

        <div className="success-thanks">
          <img src="/images/thank-you.svg" alt="" width={160} height={120} decoding="async" />
          <p>
            {lang === "km" ? "សូមអរគុណដែលបានទិញជាមួយ " : "Thank you for shopping with "}
            <b>{settings?.siteName || "PORPOR TOPUP"}</b>
          </p>
        </div>

        <div className="success-actions">
          <Link to={`/game/${encodeURIComponent(order.gameId || "")}`} className="btn bg-brand">
            {lang === "km" ? "ទិញម្តងទៀត" : "Buy again"}
          </Link>
          <Link to="/" className="btn success-home">
            {lang === "km" ? "ទំព័រដើម" : "Home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
