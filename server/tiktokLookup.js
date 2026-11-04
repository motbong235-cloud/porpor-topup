/**
 * Resolve TikTok video/profile link → username + display + avatar.
 * Uses URL parse, oEmbed, and light HTML meta for profile image.
 */
function cleanUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  u = u.split(/\s+/)[0];
  u = u.replace(/[),.;]+$/g, "");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.slice(0, 500);
}

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
      if (loc && [301, 302, 303, 307, 308].includes(r.status)) {
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

/** Try og:image / avatar from profile or video page HTML */
async function fetchMetaImages(pageUrl) {
  const out = { avatarUrl: "", thumbnail: "", displayName: "" };
  try {
    const r = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!r.ok) return out;
    const html = (await r.text()).slice(0, 180000);
    const meta = (prop) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i",
      );
      const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
        "i",
      );
      const m = html.match(re) || html.match(re2);
      return m ? m[1].replace(/&amp;/g, "&") : "";
    };
    out.thumbnail = meta("og:image") || meta("twitter:image") || "";
    out.displayName = meta("og:title") || "";
    // TikTok often embeds avatar URLs in JSON
    const av =
      html.match(/"avatarLarger"\s*:\s*"([^"]+)"/) ||
      html.match(/"avatarMedium"\s*:\s*"([^"]+)"/) ||
      html.match(/"avatarThumb"\s*:\s*"([^"]+)"/);
    if (av && av[1]) {
      out.avatarUrl = av[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
    }
    // sometimes cover is only video thumb — still useful
    if (!out.avatarUrl && out.thumbnail && /tiktokcdn|musical\.ly|bytedance/i.test(out.thumbnail)) {
      // keep as video cover; avatar stays empty
    }
  } catch (e) {
    console.warn("[tiktok] meta fetch", e.message);
  }
  return out;
}

export async function lookupTikTokLink(rawUrl) {
  const inputUrl = cleanUrl(rawUrl);
  if (!inputUrl) {
    return {
      valid: false,
      inputUrl: "",
      resolvedUrl: "",
      username: "",
      displayName: "",
      authorUrl: "",
      title: "",
      thumbnail: "",
      avatarUrl: "",
      message: "empty_url",
    };
  }

  let resolvedUrl = inputUrl;
  if (/\/\/(vt|vm|www\.)?tiktok\.com\//i.test(inputUrl) && !/@/.test(inputUrl)) {
    resolvedUrl = await resolveRedirect(inputUrl);
  }

  let username = usernameFromTikTokUrl(resolvedUrl) || usernameFromTikTokUrl(inputUrl);
  let displayName = "";
  let authorUrl = username ? `https://www.tiktok.com/@${username}` : "";
  let title = "";
  let thumbnail = "";
  let avatarUrl = "";

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

  // Enrich avatar from profile page
  const profilePage = username ? `https://www.tiktok.com/@${username}` : authorUrl;
  if (profilePage) {
    const meta = await fetchMetaImages(profilePage);
    if (meta.avatarUrl) avatarUrl = meta.avatarUrl;
    if (!thumbnail && meta.thumbnail) thumbnail = meta.thumbnail;
    if (!displayName && meta.displayName) {
      // og:title often "Name (@user) | TikTok"
      displayName = String(meta.displayName)
        .replace(/\s*[|·].*$/, "")
        .replace(/\s*\(@[^)]+\)\s*$/, "")
        .trim()
        .slice(0, 120);
    }
  }
  // Video page meta as fallback for cover
  if (!thumbnail && resolvedUrl) {
    const metaV = await fetchMetaImages(resolvedUrl);
    if (metaV.thumbnail) thumbnail = metaV.thumbnail;
    if (!avatarUrl && metaV.avatarUrl) avatarUrl = metaV.avatarUrl;
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
    avatarUrl: avatarUrl || "",
    message: valid ? "ok" : "unresolved",
  };
}
