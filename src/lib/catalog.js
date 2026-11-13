import { useEffect, useState } from "react";

const KEY = "pp_catalog_v1";
const FRESH_MS = 30_000;

function readSaved() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Array.isArray(d.games) ? d : null;
  } catch {
    return null;
  }
}

const saved = readSaved();
let cached = saved ? saved.games : null;
let cachedAt = saved ? saved.at || 0 : 0;
let inflight = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(cached || []); } catch {}
  }
}

function load(force = false) {
  if (!force && cached && Date.now() - cachedAt < FRESH_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/catalog", { credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        cached = Array.isArray(data.games) ? data.games : [];
        cachedAt = Date.now();
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ at: cachedAt, games: cached, isReseller: !!data.isReseller }));
        } catch {}
        notify();
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Force refresh after Telegram login so reseller prices apply */
export function refreshCatalog() {
  cachedAt = 0;
  try { sessionStorage.removeItem(KEY); } catch {}
  return load(true);
}

export function useCatalog() {
  const [games, setGames] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const onUpdate = (g) => alive && setGames(g);
    listeners.add(onUpdate);
    load()
      .then((g) => {
        if (!alive) return;
        setGames(g);
        setError("");
      })
      .catch((e) => alive && !cached && setError(e.message || "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return { games, loading, error, refresh: refreshCatalog };
}
