/**
 * Resolve TikTok video/profile link → username + display (for admin accuracy).
 * Uses URL parse + official oEmbed (no unofficial scrape API).
 */
function cleanUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  // strip trailing junk from shared text
  u = u.split(/\s+/)[0];
  u = u.replace(/[),.;]+$/g, "");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.slice(0, 500);
}

/** @username from standard tiktok.com/@user/video/... */
export function usernameFromTikTokUrl(url) {
  const u = cleanUrl(url);
  if (!u) return "";
  try {
    const m = u.match(/tiktok\.com\/@([^/?#\s]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]).replace(/^@/, "");
  } catch {}
  return "";
}

async function resolveRedirect(url, maxHops = 4) {
  let current = cleanUrl(url);
  for (let i = 0; i < maxHops; i++) {
    try {
      const r = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });
      const loc = r.headers.get("location");
      if (loc && (r.status === 301 || r.status === 302 || r.status === 303 || r.status === 307 || r.status === 308)) {
        current = loc.startsWith("http") ? loc : new URL(loc, current).href;
        continue;
      }
      return current;
    } catch {
      return current;
    }
  }
  return current;
}

/**
 * @returns {{
 *   valid: boolean,
 *   inputUrl: string,
 *   resolvedUrl: string,
 *   username: string,
 *   displayName: string,
 *   authorUrl: string,
 *   title: string,
 *   thumbnail: string,
 *   message?: string
 * }}
 */
export async function lookupTikTokLink(rawUrl) {
  const inputUrl = cleanUrl(rawUrl);
  if (!inputUrl) {
    return { valid: false, inputUrl: "", resolvedUrl: "", username: "", displayName: "", authorUrl: "", title: "", thumbnail: "", message: "empty_url" };
  }

  let resolvedUrl = inputUrl;
  // short links need redirect to reveal @user
  if (/\/\/(vt|vm|www\.)?tiktok\.com\//i.test(inputUrl) && !/@/.test(inputUrl)) {
    resolvedUrl = await resolveRedirect(inputUrl);
  }

  let username = usernameFromTikTokUrl(resolvedUrl) || usernameFromTikTokUrl(inputUrl);

  let displayName = "";
  let authorUrl = username ? `https://www.tiktok.com/@${username}` : "";
  let title = "";
  let thumbnail = "";

  // oEmbed — public TikTok endpoint
  try {
    const oe = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl || inputUrl)}`;
    const r = await fetch(oe, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PorporTopup/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      if (data.author_name) displayName = String(data.author_name).slice(0, 120);
      if (data.author_url) {
        authorUrl = String(data.author_url).slice(0, 300);
        const u2 = usernameFromTikTokUrl(authorUrl);
        if (u2) username = u2;
      }
      if (data.title) title = String(data.title).slice(0, 200);
      if (data.thumbnail_url) thumbnail = String(data.thumbnail_url).slice(0, 500);
    }
  } catch (e) {
    console.warn("[tiktok] oembed failed", e.message);
  }

  const valid = Boolean(username || displayName || /tiktok\.com/i.test(resolvedUrl));
  return {
    valid,
    inputUrl,
    resolvedUrl: resolvedUrl || inputUrl,
    username: username || "",
    displayName: displayName || username || "",
    authorUrl: authorUrl || (username ? `https://www.tiktok.com/@${username}` : ""),
    title,
    thumbnail,
    message: valid ? "ok" : "unresolved",
  };
}
