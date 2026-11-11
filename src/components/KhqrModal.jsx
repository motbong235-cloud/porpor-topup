import { useEffect, useRef, useState, useCallback } from "react";
import "./KhqrModal.css";

function fmtTime(s) {
  const n = Math.max(0, Math.floor(s));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Official-style KHQR payment sheet (red header, ring timer, $ center QR).
 */
export default function KhqrModal({
  open,
  amount = 0,
  currency = "USD",
  merchant = "POR POR TOPUP",
  title = "ABA KHQR",
  orderId = "",
  qrImage = "",
  qrString = "",
  deeplink = "",
  secondsLeft = 3600,
  totalSeconds = 3600,
  lang = "km",
  paying = false,
  onClose,
  onPaidClick,
  onOpenAba,
}) {
  const canvasRef = useRef(null);
  const autoAbaRef = useRef("");
  const [phase, setPhase] = useState("qr"); // qr | scanned | paid | exp
  const [qrLibReady, setQrLibReady] = useState(() => typeof window !== "undefined" && !!window.qrcode);

  useEffect(() => {
    if (!open) {
      setPhase("qr");
      return;
    }
    if (typeof window !== "undefined" && window.qrcode) {
      setQrLibReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.async = true;
    s.onload = () => setQrLibReady(true);
    document.head.appendChild(s);
  }, [open]);

  // Auto-open ABA deeplink once per modal open (no button required)
  useEffect(() => {
    if (!open) {
      autoAbaRef.current = "";
      return;
    }
    const u = String(deeplink || "").trim();
    if (!u || autoAbaRef.current === u) return;
    autoAbaRef.current = u;
    setPhase("scanned");
    const t = setTimeout(() => {
      try {
        onOpenAba?.(u);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [open, deeplink, onOpenAba]);

  const drawQr = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !open) return;
    const x = cv.getContext("2d");
    const W = cv.width;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, W);

    const payload = (qrString || "").trim();
    if (payload && typeof window !== "undefined" && window.qrcode && !/^https?:\/\//i.test(payload) && !payload.startsWith("data:")) {
      try {
        const q = window.qrcode(0, "H");
        q.addData(payload);
        q.make();
        const n = q.getModuleCount();
        const pad = 2;
        const cell = W / (n + pad * 2);
        x.fillStyle = "#000";
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (q.isDark(r, c)) {
              x.fillRect((c + pad) * cell, (r + pad) * cell, Math.ceil(cell), Math.ceil(cell));
            }
          }
        }
      } catch {
        /* fall through to image */
      }
    } else if (qrImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const margin = W * 0.06;
        x.drawImage(img, margin, margin, W - margin * 2, W - margin * 2);
        drawDollar(x, W);
      };
      img.src =
        qrImage.startsWith("data:") || qrImage.startsWith("http")
          ? qrImage
          : `data:image/png;base64,${qrImage}`;
      return;
    }

    drawDollar(x, W);
  }, [open, qrString, qrImage, qrLibReady]);

  function drawDollar(x, W) {
    const m = W / 2;
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(m, m, W * 0.085, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#000";
    x.beginPath();
    x.arc(m, m, W * 0.068, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#fff";
    x.font = `bold ${W * 0.085}px Arial, sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("$", m, m + 2);
  }

  useEffect(() => {
    if (open && phase === "qr") drawQr();
  }, [open, phase, drawQr, qrLibReady]);

  useEffect(() => {
    if (open && secondsLeft <= 0) setPhase("exp");
  }, [open, secondsLeft]);

  if (!open) return null;

  const circ = 94.25;
  const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const dashOff = circ * (1 - ratio);

  function downloadQr() {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `khqr-${Number(amount).toFixed(2)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1200);
    });
  }

  return (
    <div
      className="kq-ov on"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`kq${phase === "paid" ? " paid" : ""}${phase === "exp" ? " exp" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="KHQR payment"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kq-head">
          <div className="kq-logo">KHQR</div>
        </div>
        <button type="button" className="kq-x" aria-label="close" onClick={onClose}>
          ✕
        </button>

        <div className="kq-body">
          <div className="kq-row">
            <h2>{title}</h2>
            <div className="kq-time">
              <svg className="kq-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="bg" cx="18" cy="18" r="15" />
                <circle
                  className="fg"
                  cx="18"
                  cy="18"
                  r="15"
                  strokeDasharray={circ}
                  style={{ strokeDashoffset: dashOff }}
                />
              </svg>
              <span className="t">{fmtTime(secondsLeft)}</span>
            </div>
          </div>

          <div className="kq-m">{merchant}</div>
          <div className="kq-amt">
            <span className="a">{Number(amount).toFixed(2)}</span>
            <small className="c">{currency}</small>
          </div>
          <div className="kq-hr" />

          {phase === "qr" ? (
            <>
              <canvas ref={canvasRef} className="kq-qr" width={640} height={640} />
              <div className="kq-scan">{lang === "km" ? "ស្កេនដើម្បីបង់" : "Scan to pay"}</div>
              <div className="kq-or">{lang === "km" ? "ឬ" : "or"}</div>
              <button type="button" className="kq-dl" onClick={downloadQr}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M12 7v7m-3-3 3 3 3-3" />
                </svg>
                {lang === "km" ? "ទាញយក QR" : "Download QR"}
              </button>
              <div className="kq-note">
                {lang === "km"
                  ? "ហើយ upload ចូល app ធនាគារ ដែល support KHQR"
                  : "and upload to a Mobile Banking app supporting KHQR"}
              </div>
              {orderId ? <p className="kq-order">Order · {orderId}</p> : null}

              {deeplink ? (
                <p className="kq-note kq-auto-aba">
                  {lang === "km"
                    ? "កំពុងបើក ABA Mobile ស្វ័យប្រវត្តិ…"
                    : "Opening ABA Mobile automatically…"}
                </p>
              ) : (
                <button type="button" className="kq-aba soft" onClick={() => setPhase("scanned")}>
                  {lang === "km" ? "ខ្ញុំបានស្កេនហើយ" : "I have scanned"}
                </button>
              )}
              <button type="button" className="kq-paid-btn" disabled={paying} onClick={onPaidClick}>
                {paying ? "…" : lang === "km" ? "ខ្ញុំបានបង់ហើយ" : "I have paid"}
              </button>
              <button type="button" className="kq-cancel" onClick={onClose}>
                {lang === "km" ? "បោះបង់" : "Cancel"}
              </button>
            </>
          ) : phase === "scanned" ? (
            <div className="kq-scanned">
              <div className="kq-wait-spin" />
              <p className="kq-scan-title">{lang === "km" ? "QR បានស្កេនហើយ" : "QR code is scanned"}</p>
              <p className="kq-note">
                {lang === "km"
                  ? "សូមបញ្ជាក់ការបង់ក្នុង app ABA"
                  : "Please confirm payment in your banking app"}
              </p>
              {orderId ? <p className="kq-order">Order · {orderId}</p> : null}
              <button type="button" className="kq-paid-btn" disabled={paying} onClick={onPaidClick}>
                {paying ? "…" : lang === "km" ? "ខ្ញុំបានបង់ហើយ" : "I have paid"}
              </button>
              <button type="button" className="kq-cancel" onClick={() => setPhase("qr")}>
                {lang === "km" ? "មើល QR ម្ដងទៀត" : "Show QR again"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="kq-state kq-ok">✓ {lang === "km" ? "ទូទាត់ជោគជ័យ" : "Payment successful"}</div>
        <div className="kq-state kq-bad">
          {lang === "km" ? "QR ផុតកំណត់ សូមបង្កើតថ្មី" : "QR expired — please create a new one"}
        </div>
      </div>
    </div>
  );
}
