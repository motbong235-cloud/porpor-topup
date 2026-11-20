import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Messenger-style in-site Live Chat — text, image, voice.
 * Thread bound to IP on server.
 */
const FALLBACK_LOGO = "/images/porpor-logo.svg";

const SEP_GAP = 15 * 60 * 1000;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*){1,3}$/u;

/** Messenger-style grouping: consecutive messages from one side share a cluster. */
function buildRows(msgs) {
  const out = [];
  let prev = null;
  msgs.forEach((m, i) => {
    const next = msgs[i + 1];
    const sep = !prev || (m.at || 0) - (prev.at || 0) > SEP_GAP;
    if (sep) out.push({ kind: "sep", key: `s${m.id}`, at: m.at });
    const joinPrev = !!prev && !sep && prev.role === m.role;
    const joinNext = !!next && next.role === m.role && (next.at || 0) - (m.at || 0) <= SEP_GAP;
    out.push({ kind: "msg", key: m.id, m, first: !joinPrev, last: !joinNext });
    prev = m;
  });
  return out;
}

function VoiceBubble({ src, duration }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const total = duration || 0;
  const bars = useMemo(() => Array.from({ length: 26 }, (_, i) => 6 + ((i * 7 + 3) % 6) * 3), []);
  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }
  return (
    <div className="mx-voice">
      <audio
        ref={ref}
        preload="metadata"
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProg(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total;
          setProg(d ? Math.min(1, a.currentTime / d) : 0);
        }}
      />
      <button type="button" className="mx-voice-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>
      <div className="mx-wave" aria-hidden="true">
        {bars.map((h, i) => (
          <i key={i} className={i / bars.length < prog ? "on" : ""} style={{ height: h }} />
        ))}
      </div>
      {total ? <span className="mx-dur">0:{String(total).padStart(2, "0")}</span> : null}
    </div>
  );
}

export function LiveChat({ lang = "km", openSignal = 0, logoUrl = "", lift = false }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [orderContext, setOrderContext] = useState(null);
  const [pinOpen, setPinOpen] = useState(true);
  const listRef = useRef(null);
  const afterRef = useRef(0);
  const threadRef = useRef("");
  const mediaRec = useRef(null);
  const recChunks = useRef([]);
  const recTimer = useRef(null);
  const recSecsRef = useRef(0);
  const fileRef = useRef(null);

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const ensureSession = useCallback(async () => {
    const body = {
      name: orderContext?.name || "",
      orderId: orderContext?.orderId || "",
    };
    const r = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    setThread(data.visitorId);
    threadRef.current = data.visitorId;
    setMessages(data.messages || []);
    afterRef.current = Math.max(0, ...(data.messages || []).map((m) => m.at || 0));
    scrollBottom();
    return data.visitorId;
  }, [orderContext]);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    function onOpen(e) {
      setOpen(true);
      setUnread(0);
      if (e.detail) {
        setOrderContext(e.detail);
        if (e.detail.prefill) setText(e.detail.prefill);
      }
    }
    window.addEventListener("pp-open-livechat", onOpen);
    return () => window.removeEventListener("pp-open-livechat", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    ensureSession().catch(() => {});
    const poll = setInterval(async () => {
      if (!alive) return;
      try {
        const r = await fetch(`/api/chat/messages?after=${afterRef.current}`);
        if (!r.ok) return;
        const data = await r.json();
        const news = data.messages || [];
        if (news.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...prev, ...news.filter((m) => !ids.has(m.id))];
          });
          afterRef.current = Math.max(afterRef.current, ...news.map((m) => m.at || 0));
          scrollBottom();
        }
      } catch {}
    }, 2200);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [open, ensureSession]);

  useEffect(() => {
    if (open && orderContext?.prefill) setText(orderContext.prefill);
  }, [open, orderContext]);

  async function uploadBlob(blob) {
    const r = await fetch("/api/chat/upload", {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
    const data = await r.json();
    if (!r.ok || !data.url) throw new Error(data.error || "upload_failed");
    return data;
  }

  async function sendPayload(payload) {
    setSending(true);
    try {
      if (!threadRef.current) await ensureSession();
      const r = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          orderId: orderContext?.orderId || "",
          name: orderContext?.name || "",
        }),
      });
      const data = await r.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        afterRef.current = Math.max(afterRef.current, data.message.at || 0);
        scrollBottom();
      }
    } catch {}
    setSending(false);
  }

  async function sendText(e) {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    await sendPayload({ type: "text", text: body });
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(lang === "km" ? "រូបធំពេក (អត់លើស 5MB)" : "Image too large (max 5MB)");
      return;
    }
    setSending(true);
    try {
      const up = await uploadBlob(file);
      await sendPayload({ type: "image", mediaUrl: up.url, text: "" });
    } catch {
      alert(lang === "km" ? "ផ្ញើរូបមិនបាន" : "Could not send image");
    }
    setSending(false);
  }

  async function startRec() {
    if (recording || sending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunks.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data?.size) recChunks.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimer.current);
        const secs = recSecsRef.current;
        setRecording(false);
        setRecSecs(0);
        const blob = new Blob(recChunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 200) return;
        setSending(true);
        try {
          const up = await uploadBlob(blob);
          await sendPayload({ type: "voice", mediaUrl: up.url, duration: secs, text: "" });
        } catch {
          alert(lang === "km" ? "ផ្ញើសំឡេងមិនបាន" : "Could not send voice");
        }
        setSending(false);
      };
      mediaRec.current = rec;
      rec.start();
      setRecording(true);
      setRecSecs(0);
      recSecsRef.current = 0;
      recTimer.current = setInterval(() => {
        recSecsRef.current += 1;
        setRecSecs(recSecsRef.current);
      }, 1000);
    } catch {
      alert(lang === "km" ? "មិនអាចបើកមីក្រូហ្វូន" : "Microphone permission denied");
    }
  }

  function stopRec() {
    if (mediaRec.current && recording) {
      try {
        mediaRec.current.stop();
      } catch {}
    }
  }

  function fmtTime(at) {
    try {
      return new Date(at).toLocaleTimeString(lang === "km" ? "km-KH" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  const title = "POR POR TOPUP";
  const online = lang === "km" ? "កំពុងអនឡាញ" : "Active now";
  const placeholder = lang === "km" ? "សរសេរសារ…" : "Aa";
  const rows = useMemo(() => buildRows(messages), [messages]);
  const avatar = logoUrl || FALLBACK_LOGO;

  function fmtSep(at) {
    try {
      const d = new Date(at);
      const loc = lang === "km" ? "km-KH" : "en-US";
      const time = d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
      if (d.toDateString() === new Date().toDateString()) return time;
      return `${d.toLocaleDateString(loc, { day: "numeric", month: "short" })}, ${time}`;
    } catch {
      return "";
    }
  }

  return (
    <>
      <button
        type="button"
        className={`float-chat livechat-fab mx-fab${lift ? " above-install" : ""}${open ? " is-open" : ""}`}
        aria-label="Live Chat"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.42 3.15 7.16.16.14.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.9.25 1.86.38 2.9.38 5.64 0 10-4.13 10-9.69C22 6.13 17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.31-.97-.19-.69-.64l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.31.97.19.69.64z" />
          </svg>
        )}
        {!open && unread > 0 ? <span className="livechat-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      <div className={`mx-panel${open ? " open" : ""}`} role="dialog" aria-label={title}>
        <header className="mx-head">
          <div className="mx-head-who">
            <div className="mx-av mx-av-lg">
              <img src={avatar} alt="" />
              <span className="mx-active" />
            </div>
            <div className="mx-head-text">
              <strong>{title}</strong>
              <span>{online}</span>
            </div>
          </div>
          <button type="button" className="mx-head-x" aria-label="Close" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="mx-list" ref={listRef}>
          <div className="mx-intro">
            <div className="mx-av mx-av-xl">
              <img src={avatar} alt="" />
            </div>
            <strong>{title}</strong>
            <span>{lang === "km" ? "ជាធម្មតាឆ្លើយតបក្នុងពេលប៉ុន្មាននាទី" : "Typically replies within minutes"}</span>
          </div>

          <div className={`mx-pin${pinOpen ? " open" : ""}`}>
            <button type="button" className="mx-pin-head" onClick={() => setPinOpen((v) => !v)}>
              <span className="mx-pin-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5 20.5 9.5l-2 .6-3.6 3.6.4 4.2-1.4 1.4-3-3.6-4.9 4.9-1.1-1.1 4.9-4.9-3.6-3 1.4-1.4 4.2.4 3.6-3.6z" /></svg>
              </span>
              <span className="mx-pin-title">{lang === "km" ? "ការណែនាំដែលបានខ្ទាស់" : "Pinned guide"}</span>
              <span className={`mx-pin-chev${pinOpen ? " up" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </button>
            {pinOpen ? (
              <div className="mx-pin-body">
                {lang === "km" ? (
                  <>
                    <p><b>1.</b> បន្ទាប់ពីបង់ប្រាក់រួច សូមផ្ញើ Order ID មកក្នុង chat នេះ</p>
                    <p><b>2.</b> Robux / Roblox: ធ្វើ <b>Quick Sign-in</b> (ម៉ឺនុយ → Quick Sign-in → កូដ ៦ខ្ទង់ → Confirm)</p>
                    <p><b>3.</b> គណនីត្រូវ Uncheck Kid · កុំផ្ញើ Password</p>
                    <p><b>4.</b> Admin ដំណើរការ និង update ស្ថានភាព order</p>
                  </>
                ) : (
                  <>
                    <p><b>1.</b> After payment, send your Order ID in this chat</p>
                    <p><b>2.</b> For login-required items, send username when asked</p>
                    <p><b>3.</b> Support will process and update your order</p>
                  </>
                )}
                <p className="mx-pin-note">{lang === "km" ? "កុំផ្ញើពាក្យសម្ងាត់ក្នុង chat បើមិនចាំបាច់" : "Never share passwords unless support requests a secure flow"}</p>
              </div>
            ) : null}
          </div>

          {orderContext?.orderId ? (
            <div className="mx-order">
              <div className="mx-order-top">
                <strong>{orderContext.title || (lang === "km" ? "ការបញ្ជាទិញថ្មី" : "New Order")}</strong>
                <span className="mx-order-badge">{orderContext.status || "ASSIGNED"}</span>
              </div>
              <div className="mx-order-rows">
                <div><span>Order ID</span><b>{orderContext.orderId}</b></div>
                {orderContext.username || orderContext.name ? (
                  <div><span>Username</span><b>{orderContext.username || orderContext.name}</b></div>
                ) : null}
                {orderContext.amount != null && orderContext.amount !== "" ? (
                  <div><span>Amount</span><b>${Number(orderContext.amount).toFixed(2)} USD</b></div>
                ) : null}
                {orderContext.item ? <div><span>Item</span><b>{orderContext.item}</b></div> : null}
              </div>
            </div>
          ) : null}

          {rows.map((r) => {
            if (r.kind === "sep") {
              return <div key={r.key} className="mx-sep">{fmtSep(r.at)}</div>;
            }
            const m = r.m;
            const me = m.role === "user";
            const txt = (m.text || "").trim();
            const emojiOnly = (m.type === "text" || !m.type) && txt && EMOJI_ONLY.test(txt);
            const pos = `${r.first ? " first" : ""}${r.last ? " last" : ""}`;
            return (
              <div key={r.key} className={`mx-row ${me ? "me" : "them"}${pos}`} title={fmtTime(m.at)}>
                {!me ? (
                  <div className="mx-side">
                    {r.last ? (
                      <div className="mx-av mx-av-sm"><img src={avatar} alt="" /></div>
                    ) : null}
                  </div>
                ) : null}
                {m.type === "image" && m.mediaUrl ? (
                  <a className="mx-img" href={m.mediaUrl} target="_blank" rel="noreferrer">
                    <img src={m.mediaUrl} alt="" />
                  </a>
                ) : (
                  <div className={`mx-bubble${emojiOnly ? " emoji" : ""}${m.type === "voice" ? " voice" : ""}`}>
                    {m.type === "voice" && m.mediaUrl ? <VoiceBubble src={m.mediaUrl} duration={m.duration} /> : null}
                    {(m.type === "text" || !m.type) && m.text ? <span className="mx-text">{m.text}</span> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {recording ? (
          <div className="mx-rec">
            <span className="mx-rec-dot" />
            <span className="mx-rec-t">{lang === "km" ? "កំពុងថត" : "Recording"} · 0:{String(recSecs).padStart(2, "0")}</span>
            <button type="button" className="mx-rec-send" onClick={stopRec}>
              {lang === "km" ? "ផ្ញើ" : "Send"}
            </button>
          </div>
        ) : null}

        <form className="mx-composer" onSubmit={sendText}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          {text.trim() ? null : (
            <>
              <button type="button" className="mx-ic" title="Voice" aria-label="Voice message" disabled={sending || recording} onClick={startRec}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.92V20H9.5a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2H13v-2.58A6 6 0 0 0 18 11.5z" /></svg>
              </button>
              <button type="button" className="mx-ic" title="Photo" aria-label="Send a photo" disabled={sending || recording} onClick={() => fileRef.current?.click()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM4.2 17.6l3.9-4.5a1 1 0 0 1 1.5 0l2 2.3 3-3.7a1 1 0 0 1 1.5 0l3.6 4.4a.5.5 0 0 1-.4.8H4.6a.5.5 0 0 1-.4-.8z" /></svg>
              </button>
            </>
          )}
          <input
            className="mx-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            autoComplete="off"
            disabled={recording}
          />
          {text.trim() ? (
            <button type="submit" className="mx-ic mx-send" disabled={sending} aria-label="Send">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21.85 12.5a.6.6 0 0 0 0-1.1L3.4 3.6a.6.6 0 0 0-.84.7L4.7 10.7 14 12l-9.3 1.3-2.14 6.4a.6.6 0 0 0 .84.7z" /></svg>
            </button>
          ) : (
            <button type="button" className="mx-ic mx-like" aria-label="Like" disabled={sending || recording} onClick={() => sendPayload({ type: "text", text: "👍" })}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M2 10.5A1.5 1.5 0 0 1 3.5 9h2A1.5 1.5 0 0 1 7 10.5v9A1.5 1.5 0 0 1 5.5 21h-2A1.5 1.5 0 0 1 2 19.5v-9zM8.5 10.2c0-.4.15-.8.43-1.1l4.1-4.5a1.1 1.1 0 0 1 1.9.8L14.2 8.5h4.6a2.2 2.2 0 0 1 2.15 2.7l-1.6 7.1a2.5 2.5 0 0 1-2.44 1.95H10a1.5 1.5 0 0 1-1.5-1.5v-9.55z" /></svg>
            </button>
          )}
        </form>
      </div>
    </>
  );
}
