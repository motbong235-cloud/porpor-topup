import { useEffect, useState } from "react";

let cached = null;
let inflight = null;

function load() {
  if (!inflight) {
    inflight = fetch("/api/catalog")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        cached = Array.isArray(data.games) ? data.games : [];
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Live catalog from the server (games selected from Khmer TopUp). */
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
      .catch((e) => alive && setError(e.message || "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { games, loading, error };
}
