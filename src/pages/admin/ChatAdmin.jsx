import { useEffect, useRef, useState } from "react";
import { api } from "./ui";
import "./Admin.css";

export default function ChatAdmin() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  async function loadThreads() {
    try {
      const data = await api("/api/admin/chat/threads");
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(id) {
    setActive(id);
    try {
      const data = await api(`/api/admin/chat/${id}`);
      setMessages(data.messages || []);
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
      loadThreads();
    } catch {
      setMessages([]);
    }
  }

  async function uploadBlob(blob) {
    const r = await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
    // admin upload only accepts images — for voice use chat upload
    if (!r.ok) {
      const r2 = await fetch("/api/chat/upload", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || "upload");
      return d2;
    }
    return r.json();
  }

  async function send(e) {
    e?.preventDefault?.();
    if (!text.trim() || !active || sending) return;
    setSending(true);
    try {
      const data = await api(`/api/admin/chat/${active}`, {
        method: "POST",
        body: JSON.stringify({ type: "text", text: text.trim() }),
      });
      if (data.message) {
        setMessages((m) => [...m, data.message]);
        setText("");
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      }
    } catch {}
    setSending(false);
  }

  async function sendImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    setSending(true);
    try {
      const up = await uploadBlob(file);
      const data = await api(`/api/admin/chat/${active}`, {
        method: "POST",
        body: JSON.stringify({ type: "image", mediaUrl: up.url }),
      });
      if (data.message) setMessages((m) => [...m, data.message]);
    } catch {}
    setSending(false);
  }

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => openThread(active), 3500);
    return () => clearInterval(t);
  }, [active]);

  function renderBody(m) {
    if (m.type === "image" && m.mediaUrl) {
      return (
        <a href={m.mediaUrl} target="_blank" rel="noreferrer">
          <img src={m.mediaUrl} alt="" style={{ maxWidth: 200, borderRadius: 10 }} />
        </a>
      );
    }
    if (m.type === "voice" && m.mediaUrl) {
      return <audio controls src={m.mediaUrl} style={{ maxWidth: 220 }} />;
    }
    return m.text;
  }

  return (
    <div className="ad-chat-layout">
      <div className="ad-card ad-chat-list">
        <div className="ad-card-head">
          <h2>Live Chat</h2>
          <button type="button" className="ad-btn soft sm" onClick={loadThreads}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="ad-loading">…</div>
        ) : threads.length === 0 ? (
          <div className="ad-empty">មិនទាន់មានសារ</div>
        ) : (
          <ul className="ad-chat-threads">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  className={active === th.id ? "active" : ""}
                  onClick={() => openThread(th.id)}
                >
                  <strong>{th.ip || th.id}</strong>
                  <span className="muted">
                    {th.name ? `${th.name} · ` : ""}
                    {th.orderId ? `Order ${th.orderId} · ` : ""}
                    {th.last?.text?.slice(0, 36) || "—"}
                  </span>
                  {th.unreadAdmin > 0 ? <em className="badge">{th.unreadAdmin}</em> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ad-card ad-chat-main">
        {!active ? (
          <div className="ad-empty">ជ្រើស conversation</div>
        ) : (
          <>
            <div className="ad-card-head">
              <h2>IP · {active}</h2>
            </div>
            <div className="ad-chat-msgs" ref={listRef}>
              {messages.map((m) => (
                <div key={m.id} className={`ad-chat-bubble ${m.role}`}>
                  {renderBody(m)}
                  <time>{new Date(m.at).toLocaleString()}</time>
                </div>
              ))}
            </div>
            <form className="ad-chat-form" onSubmit={send}>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendImage} />
              <button type="button" className="ad-btn soft" onClick={() => fileRef.current?.click()} disabled={sending}>
                📷
              </button>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="ឆ្លើយតប…" />
              <button type="submit" className="ad-btn primary" disabled={!text.trim() || sending}>
                ផ្ញើ
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
