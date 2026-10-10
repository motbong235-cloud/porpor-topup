import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { t } from "../lib/i18n";
import { money } from "../lib/store";

/**
 * Payment Successful page (like dinotopups):
 * - Shows order summary
 * - Live Chat → Telegram admin with Order ID + amount prefilled
 * - Customer does not fill anything else
 */
export default function Success({ lang, settings }) {
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!code);
  const [err, setErr] = useState("");

  const telegram = settings?.telegram || "https://t.me/porportopup";

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

  const isGift = order.deliveryType === "gift_code";
  const paid = order.status !== "pending" && order.status !== "failed";

  return (
    <div className="container success-page">
      <div className="success-card card">
        <div className="success-icon" aria-hidden>
          ✓
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
          {!isGift && order.userId && order.userId !== "gift" ? (
            <div className="row">
              <span>ID</span>
              <strong>
                {order.userId}
                {order.zoneId ? ` (${order.zoneId})` : ""}
              </strong>
            </div>
          ) : null}
          <div className="row">
            <span>{lang === "km" ? "វិធីទូទាត់" : "Payment Method"}</span>
            <strong>ABA KHQR</strong>
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
            <strong>{new Date(order.createdAt).toLocaleString(lang === "km" ? "km-KH" : "en-US")}</strong>
          </div>
          {order.giftCode ? (
            <div className="row">
              <span>{lang === "km" ? "កូដ" : "Code"}</span>
              <strong className="mono">{order.giftCode}</strong>
            </div>
          ) : null}
        </div>

        {/* Live Chat CTA — no extra form for the customer */}
        <div className="success-chat-box">
          <p>
            {lang === "km"
              ? "សូមចូល Live Chat ជាមួយ Admin ដើម្បីទទួលការបញ្ចូល / កូដ។ Order ID នឹងភ្ជាប់ស្វ័យប្រវត្តិ។"
              : "Open Live Chat with Admin to receive delivery / code. Your Order ID is attached automatically."}
          </p>
          <a className="btn success-livechat" href={liveChatUrl(order)} target="_blank" rel="noreferrer">
            💬 Live Chat
          </a>
        </div>

        <div className="success-actions">
          <Link to="/" className="btn btn-soft">
            {lang === "km" ? "បញ្ចូលម្តងទៀត" : "Top up another"}
          </Link>
          <Link to={`/track?code=${encodeURIComponent(order.id)}`} className="btn bg-brand">
            {t(lang, "track")}
          </Link>
        </div>
      </div>
    </div>
  );
}
