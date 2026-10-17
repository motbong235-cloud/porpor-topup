import { useEffect, useRef, useState } from "react";
import { api } from "./ui";
import "./Admin.css";

export default function ChatAdmin() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

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

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    try {
      const data = await api(`/api/admin/chat/${active}`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim() }),
      });
      if (data.message) {
        setMessages((m) => [...m, data.message]);
        setText("");
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      }
    } catch {}
  }

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => openThread(active), 3000);
    return () => clearInterval(t);
  }, [active]);

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
                  {m.text}
                  <time>{new Date(m.at).toLocaleString()}</time>
                </div>
              ))}
            </div>
            <form className="ad-chat-form" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="ឆ្លើយតប…" />
              <button type="submit" className="ad-btn primary" disabled={!text.trim()}>
                ផ្ញើ
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
