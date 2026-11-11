/**
 * Resolve TikTok video/profile link → username + display + avatar.
 * URL parse + redirect + oEmbed + HTML (SIGI / meta).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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
    // @user in path
    let m = u.match(/tiktok\.com\/@([^/?#\s]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]).replace(/^@/, "").slice(0, 64);
    // share style sometimes embeds @user
    m = u.match(/[?&]username=([^&#]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]).replace(/^@/, "").slice(0, 64);
  } catch {}
  return "";
}

function isShortTikTok(url) {
  return /\/\/(vm\.|vt\.|www\.)?tiktok\.com\/(t\/)?[A-Za-z0-9]+/i.test(url)
    || /\/\/(vm|vt)\.tiktok\.com\//i.test(url);
}

async function resolveRedirect(url, maxHops = 6) {
  let current = cleanUrl(url);
  for (let i = 0; i < maxHops; i++) {
    try {
      const r = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      });
      const loc = r.headers.get("location");
      if (loc && [301, 302, 303, 307, 308].includes(r.status)) {
        current = loc.startsWith("http") ? loc : new URL(loc, current).href;
        continue;
      }
      // some short links return 200 with meta refresh
      if (r.status >= 200 && r.status < 300) {
        const text = (await r.text().catch(() => "")).slice(0, 8000);
        const meta = text.match(/http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i)
          || text.match(/url=([^"'>\s]*tiktok\.com[^"'>\s]*)/i);
        if (meta && meta[1]) {
          const next = meta[1].startsWith("http") ? meta[1] : new URL(meta[1], current).href;
          if (next !== current) {
            current = next;
            continue;
          }
        }
      }
      return current;
    } catch {
      return current;
    }
  }
  return current;
}

function metaFromHtml(html, prop) {
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
}

/** Pull uniqueId / nickname / avatar from embedded TikTok JSON blobs */
function parseTikTokEmbedded(html) {
  const out = { username: "", displayName: "", avatarUrl: "", thumbnail: "", title: "" };
  if (!html) return out;

  // __UNIVERSAL_DATA_FOR_REHYDRATION__
  try {
    const m = html.match(/id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)</i);
    if (m && m[1]) {
      const data = JSON.parse(m[1]);
      const def = data?.__DEFAULT_SCOPE__ || data;
      const detail =
        def?.["webapp.video-detail"]?.itemInfo?.itemStruct ||
        def?.["webapp.user-detail"]?.userInfo?.user ||
        null;
      if (detail) {
        const user = detail.author || detail;
        if (user.uniqueId) out.username = String(user.uniqueId);
        if (user.nickname) out.displayName = String(user.nickname);
        if (user.avatarLarger || user.avatarMedium || user.avatarThumb) {
          out.avatarUrl = String(user.avatarLarger || user.avatarMedium || user.avatarThumb);
        }
        if (detail.video?.cover || detail.video?.originCover) {
          out.thumbnail = String(detail.video.cover || detail.video.originCover);
        }
        if (detail.desc) out.title = String(detail.desc).slice(0, 200);
      }
    }
  } catch {}

  // SIGI_STATE
  try {
    const m = html.match(/<script[^>]+id="SIGI_STATE"[^>]*>([^<]+)</i);
    if (m && m[1]) {
      const data = JSON.parse(m[1]);
      const users = data?.UserModule?.users || {};
      const first = Object.values(users)[0];
      if (first) {
        if (!out.username && first.uniqueId) out.username = String(first.uniqueId);
        if (!out.displayName && first.nickname) out.displayName = String(first.nickname);
        if (!out.avatarUrl && (first.avatarLarger || first.avatarMedium)) {
          out.avatarUrl = String(first.avatarLarger || first.avatarMedium);
        }
      }
      const items = data?.ItemModule || {};
      const item = Object.values(items)[0];
      if (item) {
        if (!out.username && item.author) out.username = String(item.author);
        if (!out.title && item.desc) out.title = String(item.desc).slice(0, 200);
        if (!out.thumbnail && item.video?.cover) out.thumbnail = String(item.video.cover);
      }
    }
  } catch {}

  // uniqueId in raw html
  if (!out.username) {
    const m = html.match(/"uniqueId"\s*:\s*"([^"]+)"/);
    if (m) out.username = m[1];
  }
  if (!out.displayName) {
    const m = html.match(/"nickname"\s*:\s*"([^"]+)"/);
    if (m) out.displayName = m[1];
  }
  if (!out.avatarUrl) {
    const m = html.match(/"avatarLarger"\s*:\s*"([^"]+)"/)
      || html.match(/"avatarMedium"\s*:\s*"([^"]+)"/);
    if (m) out.avatarUrl = m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  }

  out.username = out.username.replace(/^@/, "").slice(0, 64);
  out.displayName = out.displayName.slice(0, 120);
  return out;
}

async function fetchPageHtml(pageUrl) {
  try {
    const r = await fetch(pageUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(14000),
      redirect: "follow",
    });
    if (!r.ok) return "";
    return (await r.text()).slice(0, 350000);
  } catch (e) {
    console.warn("[tiktok] page fetch", e.message);
    return "";
  }
}

async function fetchMetaImages(pageUrl) {
  const out = { avatarUrl: "", thumbnail: "", displayName: "" };
  const html = await fetchPageHtml(pageUrl);
  if (!html) return out;
  out.thumbnail = metaFromHtml(html, "og:image") || metaFromHtml(html, "twitter:image") || "";
  out.displayName = metaFromHtml(html, "og:title") || metaFromHtml(html, "twitter:title") || "";
  const emb = parseTikTokEmbedded(html);
  if (emb.avatarUrl) out.avatarUrl = emb.avatarUrl;
  if (!out.thumbnail && emb.thumbnail) out.thumbnail = emb.thumbnail;
  if (emb.displayName) out.displayName = emb.displayName || out.displayName;
  return { ...out, ...emb, html };
}

export async function lookupTikTokLink(rawUrl) {
  const inputUrl = cleanUrl(rawUrl);
  if (!inputUrl || !/tiktok\.com/i.test(inputUrl)) {
    return {
      valid: false,
      inputUrl: inputUrl || "",
      resolvedUrl: "",
      username: "",
      displayName: "",
      authorUrl: "",
      title: "",
      thumbnail: "",
      avatarUrl: "",
      message: "empty_or_not_tiktok",
    };
  }

  let resolvedUrl = inputUrl;
  // Expand short / share links so @username appears in path
  if (isShortTikTok(inputUrl) || !/@/.test(inputUrl)) {
    try {
      resolvedUrl = await resolveRedirect(inputUrl);
    } catch {
      resolvedUrl = inputUrl;
    }
  }

  let username = usernameFromTikTokUrl(resolvedUrl) || usernameFromTikTokUrl(inputUrl);
  let displayName = "";
  let authorUrl = username ? `https://www.tiktok.com/@${username}` : "";
  let title = "";
  let thumbnail = "";
  let avatarUrl = "";

  // oEmbed
  try {
    const oeUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl || inputUrl)}`;
    const r = await fetch(oeUrl, {
      headers: { "User-Agent": UA, Accept: "application/json" },
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

  // HTML scrape on video + profile
  const pages = [];
  if (resolvedUrl) pages.push(resolvedUrl);
  if (inputUrl && inputUrl !== resolvedUrl) pages.push(inputUrl);
  if (username) pages.push(`https://www.tiktok.com/@${username}`);

  for (const page of pages) {
    if (username && displayName && avatarUrl) break;
    const html = await fetchPageHtml(page);
    if (!html) continue;
    const emb = parseTikTokEmbedded(html);
    if (!username && emb.username) username = emb.username;
    if (!displayName && emb.displayName) displayName = emb.displayName;
    if (!avatarUrl && emb.avatarUrl) avatarUrl = emb.avatarUrl;
    if (!thumbnail && emb.thumbnail) thumbnail = emb.thumbnail;
    if (!title && emb.title) title = emb.title;
    if (!username) {
      const u = usernameFromTikTokUrl(page);
      if (u) username = u;
    }
    if (!thumbnail) {
      const og = metaFromHtml(html, "og:image");
      if (og) thumbnail = og;
    }
    if (!displayName) {
      const ogt = metaFromHtml(html, "og:title");
      if (ogt) {
        displayName = String(ogt)
          .replace(/\s*[|·].*$/, "")
          .replace(/\s*\(@[^)]+\)\s*$/, "")
          .trim()
          .slice(0, 120);
      }
    }
  }

  if (username) authorUrl = `https://www.tiktok.com/@${username}`;
  if (!displayName && username) displayName = username;

  // Must have username to be valid (avoid false positive on empty short links)
  const valid = Boolean(username);
  return {
    valid,
    inputUrl,
    resolvedUrl: resolvedUrl || inputUrl,
    username: username || "",
    displayName: displayName || username || "",
    authorUrl: authorUrl || "",
    title,
    thumbnail,
    avatarUrl: avatarUrl || "",
    message: valid ? "ok" : "unresolved_username",
  };
}
