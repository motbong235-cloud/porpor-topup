import { useCallback, useEffect, useRef, useState } from "react";
import { AIcon, api } from "./ui";
import "./Admin.css";

const QUICK = [
  { t: "សួស្តី! មានអ្វីអាចជួយបាន?", s: "សួស្តី" },
  { t: "កំពុងពិនិត្យ Order ឲ្យ…", s: "កំពុងពិនិត្យ" },
  { t: "បានរួចរាល់ហើយ ✅", s: "រួចរាល់" },
  { t: "សូមរង់ចាំបន្តិច", s: "រង់ចាំ" },
  { t: "សូមផ្ញើរូបភស្តុតាង", s: "ផ្ញើរូប" },
];

function fmtTime(at) {
  if (!at) return "";
  try {
    const d = new Date(at);
    const now = new Date();
    const same =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (same) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function preview(m) {
  if (!m) return "—";
  if (m.type === "image") return "📷 រូបភាព";
  if (m.type === "voice" || m.type === "audio") return "🎤 សំឡេង";
  const t = (m.text || "").trim();
  if (!t) return "—";
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

export default function ChatAdmin() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = active;

  const loadThreads = useCallback(async () => {
    try {
      const data = await api("/api/admin/chat/threads");
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id, silent = false) => {
    if (!id) return;
    try {
      const data = await api(`/api/admin/chat/${id}`);
      setMessages(data.messages || []);
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (!el) return;
        if (!silent || el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
          el.scrollTop = el.scrollHeight;
        }
      });
    } catch {
      if (!silent) setMessages([]);
    }
  }, []);

  async function openThread(id) {
    setActive(id);
    setText("");
    await loadMessages(id);
    await loadThreads();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function uploadBlob(blob) {
    const r = await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
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

  async function sendText(raw) {
    const body = (raw ?? text).trim();
    if (!body || !active || sending) return;
    setSending(true);
    try {
      const data = await api(`/api/admin/chat/${active}`, {
        method: "POST",
        body: JSON.stringify({ type: "text", text: body }),
      });
      if (data.message) {
        setMessages((m) => [...m, data.message]);
        setText("");
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          inputRef.current?.focus();
        });
        loadThreads();
      }
    } catch {}
    setSending(false);
  }

  async function sendImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active || sending) return;
    setSending(true);
    try {
      const up = await uploadBlob(file);
      const data = await api(`/api/admin/chat/${active}`, {
        method: "POST",
        body: JSON.stringify({ type: "image", url: up.url || up.path, text: "" }),
      });
      if (data.message) {
        setMessages((m) => [...m, data.message]);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
        loadThreads();
      }
    } catch {}
    setSending(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(text);
    }
  }

  function renderBody(m) {
    if (m.type === "image" && (m.url || m.text)) {
      return <img src={m.url || m.text} alt="" className="ad-chat-img" />;
    }
    if (m.type === "voice" || m.type === "audio") {
      return <audio controls src={m.url || m.text} className="ad-chat-audio" />;
    }
    return <p className="ad-chat-text">{m.text}</p>;
  }

  useEffect(() => {
    loadThreads();
    const t = setInterval(() => {
      loadThreads();
      if (activeRef.current) loadMessages(activeRef.current, true);
    }, 7000);
    return () => clearInterval(t);
  }, [loadThreads, loadMessages]);

  const activeThread = threads.find((th) => th.id === active);
  const q = filter.trim().toLowerCase();
  const filtered = !q
    ? threads
    : threads.filter((th) =>
        [th.name, th.ip, th.id, th.orderId, th.last?.text]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );

  const unreadTotal = threads.reduce((s, th) => s + (th.unreadAdmin || 0), 0);

  return (
    <div className="ad-chat-shell">
      <div className="ad-chat-layout">
        {/* Sidebar */}
        <aside className="ad-chat-list">
          <div className="ad-chat-list-head">
            <div>
              <h2>
                Live Chat
                {unreadTotal > 0 ? <span className="ad-chat-head-badge">{unreadTotal}</span> : null}
              </h2>
              <p className="ad-chat-sub">{threads.length} conversations</p>
            </div>
            <button type="button" className="ad-btn soft sm" onClick={loadThreads}>
              Refresh
            </button>
          </div>

          <div className="ad-chat-search">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="ស្វែងរក ឈ្មោះ / IP / Order…"
            />
          </div>

          {loading ? (
            <div className="ad-loading">…</div>
          ) : filtered.length === 0 ? (
            <div className="ad-empty">មិនទាន់មានសារ</div>
          ) : (
            <ul className="ad-chat-threads">
              {filtered.map((th) => {
                const title = th.name || "Guest";
                const lastAt = th.last?.at || th.updatedAt || th.at;
                const unread = (th.unreadAdmin || 0) > 0;
                return (
                  <li key={th.id}>
                    <button
                      type="button"
                      className={`ad-chat-item${active === th.id ? " active" : ""}${unread ? " has-unread" : ""}`}
                      onClick={() => openThread(th.id)}
                    >
                      <div className="ad-chat-avatar">{(title[0] || "G").toUpperCase()}</div>
                      <div className="ad-chat-item-body">
                        <div className="ad-chat-item-top">
                          <span className="ad-chat-item-name">{title}</span>
                          <span className="ad-chat-item-time">{fmtTime(lastAt)}</span>
                        </div>
                        {th.orderId ? (
                          <span className="ad-chat-chip">#{String(th.orderId).slice(0, 12)}</span>
                        ) : (
                          <span className="ad-chat-item-ip">{th.ip || th.id}</span>
                        )}
                        <div className={`ad-chat-item-preview${unread ? " bold" : ""}`}>
                          {preview(th.last)}
                        </div>
                      </div>
                      {unread ? <em className="ad-chat-unread">{th.unreadAdmin}</em> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Main */}
        <section className="ad-chat-main">
          {!active ? (
            <div className="ad-chat-empty-main">
              <div className="ad-chat-empty-icon">💬</div>
              <strong>ជ្រើស conversation</strong>
              <p>ចុចខាងឆ្វេងដើម្បីឆ្លើយអតិថិជន</p>
            </div>
          ) : (
            <>
              <header className="ad-chat-main-head">
                <div className="ad-chat-main-title">
                  <div className="ad-chat-avatar lg">
                    {(activeThread?.name || "G")[0].toUpperCase()}
                  </div>
                  <div className="ad-chat-main-meta">
                    <h2>{activeThread?.name || "Guest"}</h2>
                    <div className="ad-chat-meta-row">
                      <code className="ad-chat-ip-tag">{active}</code>
                      {activeThread?.orderId ? (
                        <span className="ad-chat-chip">Order {activeThread.orderId}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </header>

              <div className="ad-chat-msgs" ref={listRef}>
                {messages.length === 0 ? (
                  <div className="ad-chat-no-msg">មិនទាន់មានសារ</div>
                ) : (
                  messages.map((m) => {
                    const isAdmin = m.role === "admin" || m.role === "me" || m.role === "agent";
                    return (
                      <div key={m.id} className={`ad-chat-row ${isAdmin ? "admin" : "user"}`}>
                        <div className={`ad-chat-bubble ${isAdmin ? "me" : "user"}`}>
                          {renderBody(m)}
                          <time>{fmtTime(m.at)}</time>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="ad-chat-composer">
                <div className="ad-chat-quick">
                  {QUICK.map((q) => (
                    <button
                      key={q.s}
                      type="button"
                      className="ad-chat-quick-btn"
                      disabled={sending}
                      onClick={() => sendText(q.t)}
                      title={q.t}
                    >
                      {q.s}
                    </button>
                  ))}
                </div>
                <form className="ad-chat-form" onSubmit={(e) => { e.preventDefault(); sendText(text); }}>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendImage} />
                  <button
                    type="button"
                    className="ad-btn soft ad-chat-attach"
                    onClick={() => fileRef.current?.click()}
                    disabled={sending}
                    title="ផ្ញើរូប"
                  >
                    <AIcon name="camera" size={18} />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="វាយសារ… Enter ផ្ញើ"
                    rows={1}
                    disabled={sending}
                  />
                  <button type="submit" className="ad-btn primary ad-chat-send" disabled={!text.trim() || sending}>
                    <AIcon name="send" size={15} />
                    {sending ? "…" : "ផ្ញើ"}
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
