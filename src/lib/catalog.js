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

function load(force = false) {
  // Fresh enough (this tab already has it) → no network at all
  if (!force && cached && Date.now() - cachedAt < FRESH_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/catalog")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        cached = Array.isArray(data.games) ? data.games : [];
        cachedAt = Date.now();
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ at: cachedAt, games: cached }));
        } catch {}
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Live catalog from the server (games selected from Khmer TopUp).
 *  Shows the last known list instantly, then refreshes quietly in the background. */
export function useCatalog() {
  const [games, setGames] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
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
    };
  }, []);

  return { games, loading, error };
}
