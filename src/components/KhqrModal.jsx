import { useEffect, useRef, useState, useCallback } from "react";
import "./KhqrModal.css";

function fmtTime(s) {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function normalizeImage(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://") || s.startsWith("blob:")) return s;
  return `data:image/png;base64,${s}`;
}

/**
 * Official-style KHQR modal (red header) — image QR preferred, canvas fallback.
 */
export default function KhqrModal({
  open,
  amount = 0,
  currency = "USD",
  merchant = "POR POR TOPUP",
  title = "ABA PayWay",
  orderId = "",
  qrImage = "",
  qrString = "",
  deeplink = "",
  secondsLeft = 3600,
  totalSeconds = 3600,
  lang = "km",
  onClose,
  onOpenAba,
}) {
  const canvasRef = useRef(null);
  const autoAbaRef = useRef("");
  const [phase, setPhase] = useState("qr");
  const [libReady, setLibReady] = useState(() => typeof window !== "undefined" && !!window.qrcode);
  const [imgOk, setImgOk] = useState(false);
  const [imgFail, setImgFail] = useState(false);

  const imgSrc = normalizeImage(qrImage);
  const payload = String(qrString || "").trim();
  const hasPayload =
    payload &&
    !/^https?:\/\//i.test(payload) &&
    !payload.startsWith("data:");

  useEffect(() => {
    if (!open) {
      setPhase("qr");
      setImgOk(false);
      setImgFail(false);
      autoAbaRef.current = "";
      return;
    }
    if (typeof window !== "undefined" && window.qrcode) {
      setLibReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.async = true;
    s.onload = () => setLibReady(true);
    document.head.appendChild(s);
  }, [open]);

  // Open ABA after QR is on screen (do not hide QR)
  useEffect(() => {
    if (!open) return;
    const u = String(deeplink || "").trim();
    if (!u || autoAbaRef.current === u) return;
    autoAbaRef.current = u;
    const t = setTimeout(() => {
      try {
        onOpenAba?.(u);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [open, deeplink, onOpenAba]);

  const drawQr = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !open || !hasPayload || !libReady || !window.qrcode) return;
    try {
      const x = cv.getContext("2d");
      const W = cv.width;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, W, W);
      const q = window.qrcode(0, "M");
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
      // $ badge center
      const m = W / 2;
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(m, m, W * 0.09, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#111";
      x.beginPath();
      x.arc(m, m, W * 0.07, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#fff";
      x.font = `bold ${Math.floor(W * 0.09)}px Arial, sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("$", m, m + 2);
    } catch (e) {
      console.warn("[KhqrModal] draw", e);
    }
  }, [open, hasPayload, libReady, payload]);

  useEffect(() => {
    if (open && phase === "qr" && hasPayload && (!imgSrc || imgFail)) drawQr();
  }, [open, phase, drawQr, hasPayload, imgSrc, imgFail, libReady]);

  useEffect(() => {
    if (open && secondsLeft <= 0) setPhase("exp");
  }, [open, secondsLeft]);

  if (!open) return null;

  const circ = 94.25;
  const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const dashOff = circ * (1 - ratio);
  const showImg = imgSrc && !imgFail;
  const showCanvas = hasPayload && (!showImg || imgFail);
  const showLoading = !showImg && !showCanvas;

  function downloadQr() {
    if (showImg) {
      const a = document.createElement("a");
      a.href = imgSrc;
      a.download = `khqr-${Number(amount).toFixed(2)}.png`;
      a.click();
      return;
    }
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
      className="kq-ov"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`kq${phase === "paid" ? " paid" : ""}${phase === "exp" ? " exp" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="KHQR"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kq-head">
          <div className="kq-logo">KHQR</div>
        </div>
        <button type="button" className="kq-x" aria-label="close" onClick={onClose}>
          ✕
        </button>

        <div className="kq-body">
          {phase === "qr" || phase === "scanned" ? (
            <>
              <div className="kq-row">
                <h2>{title || "ABA PayWay"}</h2>
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

              <div className="kq-qr-wrap">
                {showImg ? (
                  <img
                    src={imgSrc}
                    alt="KHQR"
                    onLoad={() => setImgOk(true)}
                    onError={() => {
                      setImgFail(true);
                      setImgOk(false);
                    }}
                  />
                ) : null}
                {showCanvas ? (
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={640}
                    style={{ display: showImg ? "none" : "block" }}
                  />
                ) : null}
                {showLoading ? (
                  <div className="kq-qr-loading">
                    <div className="kq-wait-spin" />
                    <span>{lang === "km" ? "កំពុងបង្កើត QR…" : "Generating QR…"}</span>
                  </div>
                ) : null}
              </div>

              <div className="kq-scan">{lang === "km" ? "ស្កេនដើម្បីបង់" : "Scan to pay"}</div>
              <div className="kq-or">{lang === "km" ? "ឬ" : "or"}</div>
              <button type="button" className="kq-dl" onClick={downloadQr} disabled={showLoading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M12 7v7m-3-3 3 3 3-3" />
                </svg>
                {lang === "km" ? "រក្សាទុករូប QR" : "Save QR image"}
              </button>
              <div className="kq-note">
                {lang === "km"
                  ? "ស្កេនពីកម្មវិធីធនាគារ (ABA / KHQR)"
                  : "Scan with ABA or any KHQR banking app"}
              </div>
              {orderId ? <p className="kq-order">Order · {orderId}</p> : null}
              {deeplink ? (
                <p className="kq-note">
                  {lang === "km" ? "កំពុងបើក ABA Mobile…" : "Opening ABA Mobile…"}
                </p>
              ) : null}
              <p className="kq-note">
                {lang === "km"
                  ? "បង់រួច ប្រព័ន្ធរកឃើញស្វ័យប្រវត្តិ"
                  : "After payment, status updates automatically"}
              </p>
              <button type="button" className="kq-cancel" onClick={onClose}>
                {lang === "km" ? "បិទ" : "Close"}
              </button>
            </>
          ) : null}
        </div>

        <div className="kq-state kq-ok">✓ {lang === "km" ? "ទូទាត់ជោគជ័យ" : "Payment successful"}</div>
        <div className="kq-state kq-bad">
          {lang === "km" ? "QR ផុតកំណត់ សូមបង្កើតថ្មី" : "QR expired — create a new one"}
        </div>
      </div>
    </div>
  );
}
