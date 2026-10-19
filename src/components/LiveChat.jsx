import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Messenger-style in-site Live Chat — text, image, voice.
 * Thread bound to IP on server.
 */
export function LiveChat({ lang = "km", openSignal = 0 }) {
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
        const secs = recSecs;
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
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
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

  const title = lang === "km" ? "Live Chat · POR POR" : "Live Chat · POR POR";
  const online = lang === "km" ? "កំពុងអនឡាញ" : "Active now";
  const placeholder = lang === "km" ? "Aa" : "Aa";

  return (
    <>
      <button
        type="button"
        className="float-chat bg-brand livechat-fab"
        aria-label="Live Chat"
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
        </svg>
        {unread > 0 ? <span className="livechat-badge">{unread}</span> : null}
      </button>

      <div className={`msgr-panel${open ? " open" : ""}`} role="dialog" aria-label={title}>
        <header className="msgr-head">
          <div className="msgr-head-left">
            <div className="msgr-avatar">PP</div>
            <div>
              <strong>{title}</strong>
              <span className="msgr-status"><span className="msgr-dot" /> {online}</span>
            </div>
          </div>
          <button type="button" className="msgr-x" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </header>

        <div className="msgr-list" ref={listRef}>
          {/* Pinned guide — Dino-style */}
          <div className={`msgr-pin${pinOpen ? " open" : ""}`}>
            <button type="button" className="msgr-pin-head" onClick={() => setPinOpen((v) => !v)}>
              <span className="msgr-pin-ico">🔔</span>
              <span className="msgr-pin-title">
                {lang === "km" ? "PINNED GUIDE · របៀបប្រើ" : "PINNED GUIDE"}
              </span>
              <span className="msgr-pin-chev">{pinOpen ? "▾" : "▸"}</span>
            </button>
            {pinOpen ? (
              <div className="msgr-pin-body">
                {lang === "km" ? (
                  <>
                    <p><b>1.</b> បន្ទាប់ពីបង់ប្រាក់រួច សូមផ្ញើ Order ID មកក្នុង chat នេះ</p>
                    <p><b>2.</b> បើ service ត្រូវ Login (Roblox/Robux…) ផ្ញើ Username + ព័ត៌មានតាមសំណើ admin</p>
                    <p><b>3.</b> Admin នឹងដំណើរការ និង update ស្ថានភាព order</p>
                    <p className="msgr-pin-note">កុំផ្ញើពាក្យសម្ងាត់ក្នុង chat បើមិនចាំបាច់</p>
                  </>
                ) : (
                  <>
                    <p><b>1.</b> After payment, send your Order ID in this chat</p>
                    <p><b>2.</b> For login-required items, send username when asked</p>
                    <p><b>3.</b> Support will process and update your order</p>
                    <p className="msgr-pin-note">Never share passwords unless support requests a secure flow</p>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* New Order card */}
          {orderContext?.orderId ? (
            <div className="msgr-order-card">
              <div className="msgr-order-top">
                <strong>{orderContext.title || (lang === "km" ? "ការបញ្ជាទិញថ្មី" : "New Order")}</strong>
                <span className="msgr-order-badge">{orderContext.status || "ASSIGNED"}</span>
              </div>
              <div className="msgr-order-rows">
                <div><span>Order ID</span><b>{orderContext.orderId}</b></div>
                {orderContext.username || orderContext.name ? (
                  <div><span>Username</span><b>{orderContext.username || orderContext.name}</b></div>
                ) : null}
                {orderContext.amount != null && orderContext.amount !== "" ? (
                  <div><span>Amount</span><b>${Number(orderContext.amount).toFixed(2)} USD</b></div>
                ) : null}
                {orderContext.item ? (
                  <div><span>Item</span><b>{orderContext.item}</b></div>
                ) : null}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={`msgr-row ${m.role === "user" ? "me" : "them"}`}>
              {m.role !== "user" ? <div className="msgr-mini-av">PP</div> : null}
              <div className="msgr-col">
                <div className={`msgr-bubble ${m.type || "text"}`}>
                  {m.type === "image" && m.mediaUrl ? (
                    <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                      <img src={m.mediaUrl} alt="" className="msgr-img" />
                    </a>
                  ) : null}
                  {m.type === "voice" && m.mediaUrl ? (
                    <div className="msgr-voice">
                      <audio controls preload="metadata" src={m.mediaUrl} />
                      {m.duration ? <span className="msgr-dur">{m.duration}s</span> : null}
                    </div>
                  ) : null}
                  {(m.type === "text" || !m.type) && m.text ? <span className="msgr-text">{m.text}</span> : null}
                </div>
                <time className="msgr-time">{fmtTime(m.at)}</time>
              </div>
            </div>
          ))}
        </div>

        {recording ? (
          <div className="msgr-rec-bar">
            <span className="msgr-rec-dot" />
            {lang === "km" ? "កំពុងថត" : "Recording"}… {recSecs}s
            <button type="button" className="msgr-rec-stop" onClick={stopRec}>
              {lang === "km" ? "ផ្ញើ" : "Send"}
            </button>
          </div>
        ) : null}

        <form className="msgr-composer" onSubmit={sendText}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <button
            type="button"
            className="msgr-icon-btn"
            title="Photo"
            disabled={sending || recording}
            onClick={() => fileRef.current?.click()}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10.5" r="1.5" />
              <path d="m21 15-5-5L5 19" />
            </svg>
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            autoComplete="off"
            disabled={recording}
          />
          {text.trim() ? (
            <button type="submit" className="msgr-send" disabled={sending} aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21 23 12 2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className={`msgr-icon-btn mic${recording ? " on" : ""}`}
              title="Voice"
              disabled={sending}
              onClick={recording ? stopRec : startRec}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </>
  );
}
