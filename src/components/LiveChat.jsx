import { useCallback, useEffect, useRef, useState } from "react";

const VISITOR_KEY = "pp_chat_visitor";

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "v_anon";
  }
}

/**
 * In-site Live Chat widget (no Telegram redirect).
 * openWithOrder: optional { orderId, prefill } when opened from Success page.
 */
export function LiveChat({ lang = "km", openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const listRef = useRef(null);
  const afterRef = useRef(0);
  const threadRef = useRef("");

  const [orderContext, setOrderContext] = useState(null);

  // External open (e.g. Success page button)
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
    try {
      localStorage.setItem(VISITOR_KEY, data.visitorId);
    } catch {}
    scrollBottom();
    return data.visitorId;
  }, [orderContext]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    ensureSession().catch(() => {});
    const poll = setInterval(async () => {
      const tid = threadRef.current || thread;
      if (!alive || !tid) return;
      try {
        const r = await fetch(`/api/chat/messages?after=${afterRef.current}`);
        if (!r.ok) return;
        const data = await r.json();
        const news = data.messages || [];
        if (news.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of news) {
              if (!ids.has(m.id)) merged.push(m);
            }
            return merged;
          });
          afterRef.current = Math.max(afterRef.current, ...news.map((m) => m.at || 0));
          scrollBottom();
          if (!open) setUnread((u) => u + news.filter((m) => m.role === "agent").length);
        }
      } catch {}
    }, 2500);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [open, thread, ensureSession]);

  // Prefill when order context arrives
  useEffect(() => {
    if (open && orderContext?.prefill) {
      setText(orderContext.prefill);
    }
  }, [open, orderContext]);

  async function send(e) {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      let tid = thread;
      if (!tid) tid = await ensureSession();
      const r = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body,
          orderId: orderContext?.orderId || "",
          name: orderContext?.name || "",
        }),
      });
      const data = await r.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        afterRef.current = Math.max(afterRef.current, data.message.at || 0);
        setText("");
        scrollBottom();
      }
    } catch {}
    setSending(false);
  }

  const title = lang === "km" ? "Live Chat" : "Live Chat";
  const placeholder = lang === "km" ? "សរសេរសារ…" : "Type a message…";
  const online = lang === "km" ? "ក្រុមការងារអនឡាញ" : "Support online";

  return (
    <>
      <button
        type="button"
        className="float-chat bg-brand livechat-fab"
        aria-label={title}
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
        </svg>
        {unread > 0 ? <span className="livechat-badge">{unread}</span> : null}
      </button>

      <div className={`livechat-panel${open ? " open" : ""}`} role="dialog" aria-label={title}>
        <div className="livechat-head">
          <div>
            <strong>{title}</strong>
            <span className="livechat-online">● {online}</span>
          </div>
          <button type="button" className="livechat-x" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="livechat-list" ref={listRef}>
          {messages.map((m) => (
            <div key={m.id} className={`livechat-bubble ${m.role === "user" ? "me" : "agent"}`}>
              {m.text}
            </div>
          ))}
        </div>
        <form className="livechat-form" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            autoComplete="off"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send">
            ➤
          </button>
        </form>
      </div>
    </>
  );
}
