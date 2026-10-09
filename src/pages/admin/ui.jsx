import { useRef, useState } from "react";

/* ---------- API helper ---------- */
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // session expired → send the admin back to the login screen
    if (res.status === 401 && !path.includes("/login") && !path.includes("/me")) {
      window.dispatchEvent(new Event("admin-unauthorized"));
    }
    throw Object.assign(new Error(data.error || "error"), { status: res.status, data });
  }
  return data;
}

/* ---------- Toasts (fire from anywhere) ---------- */
export function toast(message, tone = "ok") {
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, tone } }));
}

/* ---------- Icons ---------- */
const PATHS = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  orders: "M6 2h12a1 1 0 011 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 011-1zm3 6h6M9 12h6",
  services: "M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8L12 2zM5 21h14",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 002 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  store: "M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  upload: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8zm8 9a4 4 0 100-8 4 4 0 000 8z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12M18 6L6 18",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  chevron: "M6 9l6 6 6-6",
  wallet: "M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zm13 6h2",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  alert: "M12 3l10 18H2L12 3zm0 7v5m0 3v.01",
  money: "M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2 2.7 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-14v5l3 2",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v9",
};

export function AIcon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      className={`ad-switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

/* ---------- Status badge ---------- */
export const STATUS = {
  pending: { km: "រង់ចាំបង់ប្រាក់", tone: "warn" },
  paid: { km: "បានបង់ប្រាក់", tone: "info" },
  processing: { km: "កំពុងបញ្ចូល", tone: "info" },
  delivered: { km: "ជោគជ័យ", tone: "ok" },
  failed: { km: "បរាជ័យ", tone: "bad" },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || { km: status, tone: "warn" };
  return <span className={`ad-badge ${s.tone}`}>{s.km}</span>;
}

/* ---------- Image upload ---------- */

/** Center-crop to a square and shrink, so uploads stay small and tiles look uniform. */
async function prepareImage(file, size) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
  bmp.close?.();
  let blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.9));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return blob;
}

/** Upload one image file → returns its public URL (e.g. /uploads/abc.webp). */
export async function uploadImage(file, size = 512) {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  if (file.size > 15 * 1024 * 1024) throw new Error("too_large");
  const blob = await prepareImage(file, size);
  const data = await api("/api/admin/upload", {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  return data.url;
}

/**
 * Click-to-upload image slot.
 * src      → image currently shown (custom or supplier default)
 * custom   → true when the shown image was uploaded by the admin (shows the ✕ clear button)
 */
export function ImageSlot({ src, fallback = "?", size = 64, custom, onUrl, onClear, label = "Upload image", round = 14 }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, size >= 64 ? 512 : 256);
      onUrl(url);
    } catch (err) {
      const msg =
        err.message === "not_image"
          ? "សូមជ្រើសរើសឯកសាររូបភាព"
          : err.message === "too_large" || err.status === 413
            ? "រូបធំពេក (អតិបរមា 15MB)"
            : "Upload មិនបានទេ សូមព្យាយាមម្តងទៀត";
      toast(msg, "bad");
    } finally {
      setBusy(false);
    }
  }

  const showImg = src && broken !== src;

  return (
    <div className="ad-slot" style={{ width: size, height: size, borderRadius: round }}>
      <button
        type="button"
        className="ad-slot-btn"
        onClick={() => input.current?.click()}
        title={label}
        aria-label={label}
        disabled={busy}
        style={{ borderRadius: round }}
      >
        {showImg ? (
          <img src={src} alt="" onError={() => setBroken(src)} />
        ) : (
          <span className="ad-slot-mark" style={{ fontSize: Math.max(11, size / 3.4) }}>
            {fallback}
          </span>
        )}
        <span className={`ad-slot-over${busy ? " busy" : ""}`}>
          {busy ? <span className="ad-spin" /> : <AIcon name="camera" size={Math.max(14, size / 3.6)} />}
        </span>
      </button>
      {custom && onClear ? (
        <button type="button" className="ad-slot-x" onClick={onClear} title="លុបរូបនេះ" aria-label="Remove image">
          <AIcon name="x" size={11} />
        </button>
      ) : null}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHead({ km, en, children }) {
  return (
    <div className="ad-head">
      <div>
        <h1>{km}</h1>
        <p>{en}</p>
      </div>
      {children ? <div className="ad-head-actions">{children}</div> : null}
    </div>
  );
}

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} វិនាទីមុន`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} នាទីមុន`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ម៉ោងមុន`;
  return `${Math.round(h / 24)} ថ្ងៃមុន`;
}

export const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
