import { useRef, useState } from "react";
import "./AdminExtras.css";

/* ---------- API helper ---------- */
function readCsrf() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )porpor_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function api(path, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCsrf();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  try {
    const tok = sessionStorage.getItem("pp_admin_token");
    if (tok) headers["x-admin-token"] = tok;
  } catch {}
  const res = await fetch(path, {
    credentials: "include",
    ...opts,
    headers,
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
  chevR: "M9 6l6 6-6 6",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  wallet: "M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zm13 6h2",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  alert: "M12 3l10 18H2L12 3zm0 7v5m0 3v.01",
  money: "M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2 2.7 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-14v5l3 2",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v9",
  plus: "M12 5v14M5 12h14",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  download: "M12 4v12m0 0l-4-4m4 4l4-4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  chat: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
  image: "M4 5h16v14H4V5zm0 11l4-4 3 3 4-5 5 6M9 9.5v.01",
  video: "M3 6h12a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zm14 4l5-3v10l-5-3z",
  copy: "M9 9h11v11H9V9zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
  note: "M6 3h9l4 4v14H6V3zm9 0v4h4M9 12h7M9 16h7",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-9v5m0-8.5v.01",
  support: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-6a3 3 0 100-6 3 3 0 000 6zM5.6 5.6l3.5 3.5m5.8 5.8l3.5 3.5m0-12.8l-3.5 3.5m-5.8 5.8l-3.5 3.5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
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

/**
 * Shrink an image before upload.
 * mode "square" → center-crop to a square (game / package tiles)
 * mode "fit"    → keep the original shape, only limit the width (logo / banner)
 */
async function prepareImage(file, size, mode = "square") {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (mode === "fit") {
    const k = Math.min(1, size / bmp.width);
    canvas.width = Math.max(1, Math.round(bmp.width * k));
    canvas.height = Math.max(1, Math.round(bmp.height * k));
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  } else {
    const side = Math.min(bmp.width, bmp.height);
    const out = Math.min(size, side);
    canvas.width = out;
    canvas.height = out;
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
  }
  bmp.close?.();
  let blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.9));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return blob;
}

/** Upload one image file → returns its public URL (e.g. /uploads/abc.webp). */
export async function uploadImage(file, size = 512, mode = "square") {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  if (file.size > 15 * 1024 * 1024) throw new Error("too_large");
  const blob = await prepareImage(file, size, mode);
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
 * custom   → true when the shown image was uploaded by the admin (shows the clear (X) button)
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
          <img style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} src={src} alt="" onError={() => setBroken(src)} />
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

/**
 * Click-to-upload slot that keeps the image's own shape (logo / banner).
 * ratio    → CSS aspect-ratio of the preview box, e.g. "1 / 1" or "16 / 5"
 * maxWidth → longest width (px) the image is shrunk to before upload
 */
export function WideImageSlot({ src, ratio = "16 / 5", maxWidth = 1600, width = "100%", contain = false, onUrl, onClear, label = "Upload image", hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onUrl(await uploadImage(file, maxWidth, "fit"));
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
    <div className="ad-wide" style={{ width, maxWidth: "100%" }}>
      <div className={`ad-slot ad-wide-slot${showImg ? " has-image" : " is-empty"}`} style={{ aspectRatio: ratio, borderRadius: 16 }}>
        <button type="button" className="ad-slot-btn" onClick={() => input.current?.click()} title={label} aria-label={label} disabled={busy} style={{ borderRadius: 16 }}>
          {showImg ? (
            <>
              <img src={src} alt="Banner preview" style={contain ? { objectFit: "contain" } : undefined} onError={() => setBroken(src)} />
              <span className="ad-wide-change"><AIcon name="camera" size={15} /> ចុចដើម្បីប្តូរ Banner</span>
            </>
          ) : (
            <span className="ad-wide-empty">
              <span className="ad-wide-upload-icon"><AIcon name="upload" size={24} /></span>
              <b>{label}</b>
              <small>{hint || "ជ្រើសរើសរូបភាពពីទូរស័ព្ទ ឬកុំព្យូទ័រ"}</small>
              <em>PNG · JPG · WEBP · GIF</em>
            </span>
          )}
          <span className={`ad-slot-over${busy ? " busy" : ""}`}>{busy ? <span className="ad-spin" /> : <AIcon name="camera" size={22} />}</span>
        </button>
        {showImg && onClear ? (
          <button type="button" className="ad-slot-x" onClick={onClear} title="លុបរូបនេះ" aria-label="Remove image">
            <AIcon name="x" size={11} />
          </button>
        ) : null}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
      </div>
    </div>
  );
}

/* ---------- Video upload (with progress) ---------- */
export const MAX_VIDEO_MB = 60;

export function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("video/")) return reject(new Error("not_video"));
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return reject(new Error("too_large"));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-video");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    const csrf = readCsrf();
    if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);
    try {
      const tok = sessionStorage.getItem("pp_admin_token");
      if (tok) xhr.setRequestHeader("x-admin-token", tok);
    } catch {}
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.url) return resolve(data.url);
      if (xhr.status === 401) window.dispatchEvent(new Event("admin-unauthorized"));
      reject(Object.assign(new Error(data.error || "error"), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

/** Click / drag-drop video upload box with progress bar + preview. */
export function VideoSlot({ src, onUrl, onClear }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [over, setOver] = useState(false);

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    setPct(0);
    try {
      onUrl(await uploadVideo(file, setPct));
      toast("Upload video រួចរាល់ — កុំភ្លេចចុច រក្សាទុក", "ok");
    } catch (err) {
      const msg =
        err.message === "not_video" || err.message === "bad_video"
          ? "សូមជ្រើសរើសឯកសារ video (MP4 / MOV / WebM)"
          : err.message === "too_large" || err.status === 413
            ? `Video ធំពេក (អតិបរមា ${MAX_VIDEO_MB}MB) — សូមបង្រួមមុន`
            : "Upload មិនបានទេ សូមព្យាយាមម្តងទៀត";
      toast(msg, "bad");
    } finally {
      setBusy(false);
    }
  }

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    handle(f);
  }

  function drop(e) {
    e.preventDefault();
    setOver(false);
    if (!busy) handle(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="ad-vslot">
      {src ? (
        <div className="ad-vslot-preview">
          {(src.includes("youtube.com") || src.includes("youtu.be")) ? (
            <p className="ad-hint">▶ YouTube link: {src}</p>
          ) : (
            <video src={src} controls playsInline preload="metadata" />
          )}
          <div className="ad-vslot-actions">
            <button type="button" className="ad-btn soft" disabled={busy} onClick={() => input.current?.click()}>
              <AIcon name="upload" size={15} /> ប្តូរ video
            </button>
            <button type="button" className="ad-btn soft" disabled={busy} onClick={onClear}>
              <AIcon name="trash" size={15} /> លុប
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`ad-vslot-drop${over ? " over" : ""}${busy ? " busy" : ""}`}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <AIcon name="upload" size={28} />
          <b>ចុចដើម្បី Upload Video</b>
          <small>ឬអូសដាក់ទីនេះ · MP4 / MOV / WebM · អតិបរមា {MAX_VIDEO_MB}MB</small>
        </button>
      )}
      {busy ? (
        <div className="ad-vslot-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
          <span>{pct < 100 ? `កំពុង Upload… ${pct}%` : "កំពុងរក្សាទុក…"}</span>
        </div>
      ) : null}
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={pick} />
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

const MAX_BANNERS = 5;

/** 1–5 banners per service. Empty slot at the end adds another (until 5). */
export function BannerManager({ banners, legacy, onChange }) {
  const list = banners && banners.length ? banners : legacy ? [legacy] : [];
  const set = (next) => onChange(next.slice(0, MAX_BANNERS));
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  }
  return (
    <div className="ad-banner-set">
      <div className="ad-banner-label">
        <div className="ad-banner-heading">
          <strong><AIcon name="image" size={18} /> Banner សម្រាប់ service នេះ</strong>
          <span className="ad-banner-count">{list.length} / {MAX_BANNERS} រូប</span>
        </div>
        <small>
          Upload banner ផ្ទាល់ខ្លួនសម្រាប់ service នេះប៉ុណ្ណោះ។ Banner នឹងបង្ហាញនៅផ្នែកខាងលើទំព័រ service។
        </small>
        <div className="ad-banner-specs"><span>សមាមាត្រ 16:5</span><span>ណែនាំ 1600 × 500 px</span><span>អតិបរមា 5 រូប</span></div>
      </div>
      <div className="ad-banner-list">
        {list.map((url, i) => (
          <div key={i} className="ad-banner-item">
            <WideImageSlot
              src={url}
              ratio="16 / 5"
              maxWidth={1600}
              label={`Banner ${i + 1}`}
              onUrl={(u) => set(list.map((x, k) => (k === i ? u : x)))}
              onClear={() => set(list.filter((_, k) => k !== i))}
            />
            {list.length > 1 ? (
              <div className="ad-banner-move">
                <span>#{i + 1}</span>
                <button type="button" className="ad-btn soft sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="ឡើងលើ"><AIcon name="arrowUp" size={14} /></button>
                <button type="button" className="ad-btn soft sm" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="ចុះក្រោម"><AIcon name="arrowDown" size={14} /></button>
              </div>
            ) : null}
          </div>
        ))}
        {list.length < MAX_BANNERS ? (
          <div className="ad-banner-item">
            <WideImageSlot
              src=""
              ratio="16 / 5"
              maxWidth={1600}
              label={list.length ? "+ បន្ថែម banner service នេះ" : "Upload Banner (service នេះតែម្តង)"}
              hint={list.length ? `នៅសល់ ${MAX_BANNERS - list.length}` : "1600 × 500 px"}
              onUrl={(u) => set([...list, u])}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
