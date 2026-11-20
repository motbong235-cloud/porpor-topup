/*
 * POR POR TOPUP — in-site Live Chat (static storefront pages), Messenger look.
 * Plain JS + inline SVG + inline CSS only (no CDN, no icon fonts), so it also
 * works on phones where external assets fail to load.
 *
 * API (same as the React chat): POST /api/chat/session, GET /api/chat/messages?after=,
 * POST /api/chat/messages {type,text,mediaUrl,duration}, POST /api/chat/upload (raw body).
 * Message shape: { id, role: "user" | "agent", type: "text" | "image" | "voice", text, mediaUrl, duration, at }
 */
(() => {
  const TG_FALLBACK = "https://t.me/porportopup";
  const SEP_GAP = 15 * 60 * 1000;
  const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*){1,3}$/u;
  const NAME = "POR POR TOPUP";

  const ICON = {
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    mic: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.92V20H9.5a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2H13v-2.58A6 6 0 0 0 18 11.5z"/></svg>',
    image: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM4.2 17.6l3.9-4.5a1 1 0 0 1 1.5 0l2 2.3 3-3.7a1 1 0 0 1 1.5 0l3.6 4.4a.5.5 0 0 1-.4.8H4.6a.5.5 0 0 1-.4-.8z"/></svg>',
    send: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21.85 12.5a.6.6 0 0 0 0-1.1L3.4 3.6a.6.6 0 0 0-.84.7L4.7 10.7 14 12l-9.3 1.3-2.14 6.4a.6.6 0 0 0 .84.7z"/></svg>',
    like: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M2 10.5A1.5 1.5 0 0 1 3.5 9h2A1.5 1.5 0 0 1 7 10.5v9A1.5 1.5 0 0 1 5.5 21h-2A1.5 1.5 0 0 1 2 19.5v-9zM8.5 10.2c0-.4.15-.8.43-1.1l4.1-4.5a1.1 1.1 0 0 1 1.9.8L14.2 8.5h4.6a2.2 2.2 0 0 1 2.15 2.7l-1.6 7.1a2.5 2.5 0 0 1-2.44 1.95H10a1.5 1.5 0 0 1-1.5-1.5v-9.55z"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  };

  const CSS = `
  #pp-livechat-panel{position:fixed;inset:0;z-index:99999;display:none;font-family:system-ui,-apple-system,"Segoe UI","Kantumruy Pro","Noto Sans Khmer",sans-serif}
  #pp-livechat-panel.open{display:block}
  #pp-livechat-panel *{box-sizing:border-box}
  #pp-livechat-panel [hidden]{display:none!important}
  .ppm-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5)}
  .ppm-sheet{position:absolute;right:14px;bottom:14px;width:min(380px,calc(100vw - 20px));height:min(640px,calc(100dvh - 28px));display:flex;flex-direction:column;background:#242526;color:#e4e6eb;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.07);animation:ppm-in .22s ease both}
  @keyframes ppm-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
  @media (max-width:520px){.ppm-sheet{right:0;left:0;bottom:0;width:100%;height:min(88dvh,calc(100dvh - 24px));border-radius:16px 16px 0 0}}
  .ppm-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 10px 10px 12px;border-bottom:1px solid #3e4042;background:#242526}
  .ppm-who{display:flex;align-items:center;gap:10px;min-width:0}
  .ppm-av{position:relative;flex:none;border-radius:50%;background:#1d6adf;display:grid;place-items:center;color:#fff;font-weight:800}
  .ppm-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
  .ppm-av.lg{width:40px;height:40px;font-size:14px}.ppm-av.xl{width:72px;height:72px;font-size:24px}.ppm-av.sm{width:28px;height:28px;font-size:10px}
  .ppm-dot{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#31a24c;box-shadow:0 0 0 2px #242526}
  .ppm-ht{display:grid;line-height:1.2;min-width:0}.ppm-ht strong{font-size:16px;font-weight:700;color:#e4e6eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ppm-ht span{font-size:12.5px;color:#b0b3b8}
  .ppm-x{flex:none;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;background:transparent;color:#2d88ff}.ppm-x:hover{background:#3a3b3c}
  .ppm-list{flex:1;min-height:0;overflow-y:auto;padding:8px 10px 10px;display:flex;flex-direction:column;overscroll-behavior:contain}
  .ppm-intro{display:grid;justify-items:center;gap:2px;padding:18px 12px 12px;text-align:center}.ppm-intro strong{margin-top:8px;font-size:18px;font-weight:700}.ppm-intro span{font-size:12.5px;color:#b0b3b8}
  .ppm-sep{align-self:center;margin:14px 0 8px;font-size:12px;font-weight:500;color:#b0b3b8}
  .ppm-row{display:flex;align-items:flex-end;gap:8px;margin-top:2px}.ppm-row.first{margin-top:8px}
  .ppm-row.me{justify-content:flex-end}.ppm-row.them{justify-content:flex-start}.ppm-side{flex:none;width:28px;align-self:flex-end}
  .ppm-b{max-width:min(78%,280px);padding:8px 12px;font-size:15px;line-height:1.32;border-radius:18px;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap}
  .ppm-row.me .ppm-b{background:linear-gradient(180deg,#19a0ff,#0084ff);color:#fff}
  .ppm-row.them .ppm-b{background:#3e4042;color:#e4e6eb}
  .ppm-row.me .ppm-b,.ppm-row.me .ppm-img img{border-top-right-radius:4px;border-bottom-right-radius:4px}
  .ppm-row.me.first .ppm-b,.ppm-row.me.first .ppm-img img{border-top-right-radius:18px}
  .ppm-row.me.last .ppm-b,.ppm-row.me.last .ppm-img img{border-bottom-right-radius:18px}
  .ppm-row.them .ppm-b,.ppm-row.them .ppm-img img{border-top-left-radius:4px;border-bottom-left-radius:4px}
  .ppm-row.them.first .ppm-b,.ppm-row.them.first .ppm-img img{border-top-left-radius:18px}
  .ppm-row.them.last .ppm-b,.ppm-row.them.last .ppm-img img{border-bottom-left-radius:18px}
  .ppm-row.first.last .ppm-b,.ppm-row.first.last .ppm-img img{border-radius:18px}
  .ppm-row.pending{opacity:.6}
  .ppm-b.emoji{background:none!important;padding:0 2px;font-size:40px;line-height:1.1}
  .ppm-img{display:block;max-width:min(70%,240px)}.ppm-img img{display:block;width:100%;max-height:300px;object-fit:cover;border-radius:18px;background:#3a3b3c}
  .ppm-b.voice{padding:6px 12px 6px 6px}.ppm-voice{display:flex;align-items:center;gap:8px;min-width:170px}
  .ppm-vbtn{flex:none;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;background:#0084ff;color:#fff}
  .ppm-row.me .ppm-vbtn{background:rgba(255,255,255,.95);color:#0084ff}
  .ppm-wave{flex:1;display:flex;align-items:center;gap:2px;height:28px}.ppm-wave i{width:3px;border-radius:2px;background:currentColor;opacity:.35;transition:opacity .15s}.ppm-wave i.on{opacity:1}
  .ppm-row.them .ppm-wave{color:#2d88ff}.ppm-dur{flex:none;font-size:12px;opacity:.85;font-variant-numeric:tabular-nums}
  .ppm-rec{flex:none;display:flex;align-items:center;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#242526;border-top:1px solid #3e4042;font-size:14px}
  .ppm-rdot{width:10px;height:10px;border-radius:50%;background:#fa383e;animation:ppm-p 1s ease infinite}@keyframes ppm-p{50%{opacity:.35}}
  .ppm-rt{flex:1;font-weight:600;font-variant-numeric:tabular-nums}
  .ppm-rbtn{border:0;border-radius:99px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer;background:#3a3b3c;color:#e4e6eb}.ppm-rbtn.go{background:#0084ff;color:#fff}
  .ppm-form{flex:none;display:flex;align-items:center;gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:#242526}
  .ppm-ic{flex:none;width:36px;height:36px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;background:transparent;color:#2d88ff}.ppm-ic:hover:not(:disabled){background:#3a3b3c}.ppm-ic:disabled{opacity:.45;cursor:default}
  .ppm-in{flex:1;min-width:0;height:38px;padding:0 14px;border:0;border-radius:20px;outline:none;background:#3a3b3c;color:#e4e6eb;font:inherit;font-size:15px}.ppm-in::placeholder{color:#b0b3b8}
  .ppm-tg{display:block;text-align:center;padding:2px 8px 8px;font-size:12px;font-weight:600;color:#b0b3b8;text-decoration:none}.ppm-tg:hover{color:#2d88ff}
  @media (prefers-reduced-motion:reduce){.ppm-sheet{animation:none}.ppm-rdot{animation:none}}
  `;

  const state = { msgs: [], after: 0, timer: null, ready: false, logo: "", tg: TG_FALLBACK, tmp: 0 };
  let root = null;
  let els = {};
  let rec = null; // active recording {mr, stream, chunks, secs, tick, cancel}

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function avatar(size) {
    const a = h("div", "ppm-av " + size);
    if (state.logo) {
      const img = h("img");
      img.alt = "";
      img.src = state.logo;
      img.onerror = () => { img.remove(); a.textContent = "PP"; };
      a.appendChild(img);
    } else a.textContent = "PP";
    return a;
  }
  function tgUrl(v) {
    const u = String(v || TG_FALLBACK);
    return u.startsWith("http") ? u : "https://t.me/" + u.replace(/^@/, "");
  }

  /* ---------- data ---------- */
  function mergeMsgs(list) {
    if (!list || !list.length) return false;
    const ids = new Set(state.msgs.map((m) => m.id));
    let added = false;
    list.forEach((m) => {
      if (m && m.id && !ids.has(m.id)) { state.msgs.push(m); ids.add(m.id); added = true; }
      if (m && m.at) state.after = Math.max(state.after, m.at);
    });
    if (added) state.msgs.sort((a, b) => (a.at || 0) - (b.at || 0));
    return added;
  }
  async function api(path, opt) {
    const r = await fetch(path, Object.assign({ credentials: "same-origin" }, opt || {}));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "http_" + r.status);
    return data;
  }
  async function startSession() {
    try {
      const d = await api("/api/chat/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      state.msgs = state.msgs.filter((m) => String(m.id).startsWith("tmp"));
      mergeMsgs(d.messages || []);
      state.ready = true;
    } catch (_) { /* offline: show intro only */ }
    render(true);
  }
  async function poll() {
    if (!state.ready) return;
    try {
      const d = await api("/api/chat/messages?after=" + state.after);
      if (mergeMsgs(d.messages || [])) render(true);
    } catch (_) {}
  }

  /* ---------- rendering ---------- */
  function fmtSep(at) {
    try {
      const d = new Date(at);
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (d.toDateString() === new Date().toDateString()) return time;
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short" }) + ", " + time;
    } catch (_) { return ""; }
  }
  function voiceEl(src, duration) {
    const box = h("div", "ppm-voice");
    const audio = h("audio");
    audio.preload = "metadata";
    audio.src = src;
    const btn = h("button", "ppm-vbtn");
    btn.type = "button";
    btn.setAttribute("aria-label", "Play");
    btn.innerHTML = ICON.play;
    const wave = h("div", "ppm-wave");
    const bars = [];
    for (let i = 0; i < 26; i++) {
      const b = h("i");
      b.style.height = 6 + ((i * 7 + 3) % 6) * 3 + "px";
      wave.appendChild(b); bars.push(b);
    }
    const dur = h("span", "ppm-dur", duration ? "0:" + String(duration).padStart(2, "0") : "");
    const paint = (p) => bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < p));
    btn.addEventListener("click", () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
    audio.addEventListener("play", () => { btn.innerHTML = ICON.pause; });
    audio.addEventListener("pause", () => { btn.innerHTML = ICON.play; });
    audio.addEventListener("ended", () => { btn.innerHTML = ICON.play; paint(0); });
    audio.addEventListener("timeupdate", () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration || 0;
      paint(d ? Math.min(1, audio.currentTime / d) : 0);
    });
    box.append(audio, btn, wave, dur);
    return box;
  }
  function render(stick) {
    if (!els.list) return;
    const list = els.list;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    // keep currently playing voice from being reset
    const playing = list.querySelector("audio:not([paused])");
    if (playing && !playing.paused) return;
    list.textContent = "";
    const intro = h("div", "ppm-intro");
    intro.append(avatar("xl"), h("strong", "", NAME), h("span", "", "ជាធម្មតាឆ្លើយតបក្នុងពេលប៉ុន្មាននាទី"));
    list.appendChild(intro);
    if (!state.msgs.length) {
      const row = h("div", "ppm-row them first last");
      const side = h("div", "ppm-side"); side.appendChild(avatar("sm"));
      row.append(side, h("div", "ppm-b", "សួស្តី! សរសេរសារមក Admin នៅទីនេះ។ Hi! How can we help you today?"));
      list.appendChild(row);
    }
    let prev = null;
    state.msgs.forEach((m, i) => {
      const next = state.msgs[i + 1];
      const sep = !prev || (m.at || 0) - (prev.at || 0) > SEP_GAP;
      if (sep) list.appendChild(h("div", "ppm-sep", fmtSep(m.at)));
      const joinPrev = !!prev && !sep && prev.role === m.role;
      const joinNext = !!next && next.role === m.role && (next.at || 0) - (m.at || 0) <= SEP_GAP;
      const me = m.role === "user";
      const row = h("div", "ppm-row " + (me ? "me" : "them") + (joinPrev ? "" : " first") + (joinNext ? "" : " last") + (m.pending ? " pending" : ""));
      if (!me) {
        const side = h("div", "ppm-side");
        if (!joinNext) side.appendChild(avatar("sm"));
        row.appendChild(side);
      }
      if (m.type === "image" && m.mediaUrl) {
        const a = h("a", "ppm-img"); a.href = m.mediaUrl; a.target = "_blank"; a.rel = "noopener";
        const img = h("img"); img.src = m.mediaUrl; img.alt = ""; img.loading = "lazy";
        a.appendChild(img); row.appendChild(a);
      } else if (m.type === "voice" && m.mediaUrl) {
        const b = h("div", "ppm-b voice"); b.appendChild(voiceEl(m.mediaUrl, m.duration)); row.appendChild(b);
      } else {
        const t = String(m.text || "");
        const b = h("div", "ppm-b" + (EMOJI_ONLY.test(t.trim()) ? " emoji" : ""), t);
        row.appendChild(b);
      }
      list.appendChild(row);
      prev = m;
    });
    if (stick || nearBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }
  function syncComposer() {
    const has = !!els.input.value.trim();
    els.mic.hidden = has; els.photo.hidden = has;
    els.like.hidden = has; els.send.hidden = !has;
  }

  /* ---------- sending ---------- */
  async function post(payload) {
    const id = "tmp" + ++state.tmp;
    state.msgs.push(Object.assign({ id, role: "user", at: Date.now(), pending: true }, payload));
    render(true);
    try {
      const d = await api("/api/chat/messages", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      state.msgs = state.msgs.filter((m) => m.id !== id);
      if (d.message) mergeMsgs([d.message]);
      render(true);
      return true;
    } catch (_) {
      state.msgs = state.msgs.filter((m) => m.id !== id);
      render(true);
      return false;
    }
  }
  async function sendText() {
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = ""; syncComposer();
    const ok = await post({ type: "text", text });
    if (!ok && !els.input.value) { els.input.value = text; syncComposer(); }
  }
  async function upload(blob) {
    const r = await fetch("/api/chat/upload", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || "upload_failed");
    return d;
  }
  async function pickImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) { alert("រូបធំពេក (អតិបរមា 3MB)"); return; }
    try { const up = await upload(file); await post({ type: "image", mediaUrl: up.url, text: "" }); }
    catch (_) { alert("ផ្ញើរូបមិនបាន"); }
  }

  /* ---------- voice ---------- */
  async function startRec() {
    if (rec) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec = { mr, stream, chunks: [], secs: 0, cancel: false, tick: null };
      mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onstop = async () => {
        const r = rec; rec = null;
        r.stream.getTracks().forEach((t) => t.stop());
        clearInterval(r.tick);
        els.rec.hidden = true; els.form.hidden = false;
        const blob = new Blob(r.chunks, { type: r.mr.mimeType || "audio/webm" });
        if (r.cancel || blob.size < 200) return;
        try { const up = await upload(blob); await post({ type: "voice", mediaUrl: up.url, duration: r.secs, text: "" }); }
        catch (_) { alert("ផ្ញើសំឡេងមិនបាន"); }
      };
      mr.start();
      els.form.hidden = true; els.rec.hidden = false; els.rt.textContent = "កំពុងថត · 0:00";
      rec.tick = setInterval(() => {
        rec.secs += 1;
        els.rt.textContent = "កំពុងថត · 0:" + String(rec.secs).padStart(2, "0");
        if (rec.secs >= 120) stopRec(false);
      }, 1000);
    } catch (_) { alert("មិនអាចបើកមីក្រូហ្វូន"); }
  }
  function stopRec(cancel) {
    if (!rec) return;
    rec.cancel = !!cancel;
    try { rec.mr.stop(); } catch (_) {}
  }

  /* ---------- panel ---------- */
  function build() {
    if (root) return root;
    const style = h("style"); style.textContent = CSS; document.head.appendChild(style);
    root = h("div"); root.id = "pp-livechat-panel";
    const backdrop = h("div", "ppm-backdrop");
    const sheet = h("div", "ppm-sheet");
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Live Chat");

    const head = h("header", "ppm-head");
    const who = h("div", "ppm-who");
    const av = avatar("lg"); av.appendChild(h("span", "ppm-dot"));
    const ht = h("div", "ppm-ht"); ht.append(h("strong", "", NAME), h("span", "", "កំពុងអនឡាញ"));
    who.append(av, ht);
    const x = h("button", "ppm-x"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.innerHTML = ICON.close;
    head.append(who, x);

    const list = h("div", "ppm-list");

    const recBar = h("div", "ppm-rec"); recBar.hidden = true;
    const rdot = h("span", "ppm-rdot"); const rt = h("span", "ppm-rt", "");
    const rc = h("button", "ppm-rbtn", "បោះបង់"); rc.type = "button";
    const rs = h("button", "ppm-rbtn go", "ផ្ញើ"); rs.type = "button";
    recBar.append(rdot, rt, rc, rs);

    const form = h("form", "ppm-form");
    const mic = h("button", "ppm-ic"); mic.type = "button"; mic.title = "Voice"; mic.setAttribute("aria-label", "Voice message"); mic.innerHTML = ICON.mic;
    const photo = h("button", "ppm-ic"); photo.type = "button"; photo.title = "Photo"; photo.setAttribute("aria-label", "Send a photo"); photo.innerHTML = ICON.image;
    const file = h("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true;
    const input = h("input", "ppm-in"); input.type = "text"; input.maxLength = 2000; input.placeholder = "សរសេរសារ…"; input.autocomplete = "off";
    const like = h("button", "ppm-ic"); like.type = "button"; like.setAttribute("aria-label", "Like"); like.innerHTML = ICON.like;
    const send = h("button", "ppm-ic"); send.type = "submit"; send.setAttribute("aria-label", "Send"); send.innerHTML = ICON.send; send.hidden = true;
    form.append(file, mic, photo, input, like, send);

    const tg = h("a", "ppm-tg", "ឬ ទាក់ទង Telegram ផ្ទាល់ →"); tg.href = state.tg; tg.target = "_blank"; tg.rel = "noopener";

    sheet.append(head, list, recBar, form, tg);
    root.append(backdrop, sheet);
    document.body.appendChild(root);
    els = { list, input, form, rec: recBar, rt, mic, photo, like, send, tg, av };

    const close = () => closePanel();
    backdrop.addEventListener("click", close);
    x.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("open")) closePanel(); });
    form.addEventListener("submit", (e) => { e.preventDefault(); sendText(); });
    input.addEventListener("input", syncComposer);
    mic.addEventListener("click", startRec);
    photo.addEventListener("click", () => file.click());
    file.addEventListener("change", () => { const f = file.files && file.files[0]; file.value = ""; pickImage(f); });
    like.addEventListener("click", () => post({ type: "text", text: "👍" }));
    rc.addEventListener("click", () => stopRec(true));
    rs.addEventListener("click", () => stopRec(false));

    // site settings: Telegram link + logo
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s) return;
      state.tg = tgUrl(s.telegram || s.telegramUrl);
      tg.href = state.tg;
      document.querySelectorAll('[data-support-contact="telegram"]').forEach((n) => { n.href = state.tg; });
      if (s.logoUrl) {
        state.logo = String(s.logoUrl);
        const mk = (sz) => avatar(sz);
        const old = els.av; const fresh = mk("lg"); fresh.appendChild(h("span", "ppm-dot")); old.replaceWith(fresh); els.av = fresh;
        render(false);
      }
    }).catch(() => {});
    return root;
  }
  function openPanel(e) {
    if (e && e.preventDefault) e.preventDefault();
    build();
    document.querySelectorAll("[data-support-widget]").forEach((w) => {
      w.dataset.open = "false";
      const menu = w.querySelector("[data-support-menu]");
      if (menu) menu.hidden = true;
    });
    root.classList.add("open");
    syncComposer();
    startSession();
    clearInterval(state.timer);
    state.timer = setInterval(poll, 2500);
    if (window.matchMedia && matchMedia("(pointer: fine)").matches) setTimeout(() => els.input.focus(), 120);
  }
  function closePanel() {
    if (rec) stopRec(true);
    if (root) root.classList.remove("open");
    clearInterval(state.timer);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-support-contact="livechat"], #pp-open-livechat');
    if (a) openPanel(e);
  });
  window.addEventListener("pp-open-livechat", () => openPanel());
})();
