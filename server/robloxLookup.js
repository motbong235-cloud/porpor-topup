/**
 * Public Roblox username → profile (no API key)
 * Hardened for server environments (Render): User-Agent, retries, alternate search.
 */

const CACHE_MS = 60_000;
const cache = new Map();

const UA =
  "Mozilla/5.0 (compatible; PorporTopup/1.0; +https://porportopup.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getJson(url, init = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        ...(init.headers || {}),
      },
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { __http: r.status, __body: t.slice(0, 200) };
    }
    return await r.json().catch(() => null);
  } catch (e) {
    return { __error: e.message || "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

function isOkJson(j) {
  return j && typeof j === "object" && !j.__http && !j.__error;
}

const num = (j) => (j && Number.isFinite(Number(j.count)) ? Number(j.count) : null);

function normalizeName(username) {
  return String(username || "")
    .trim()
    .replace(/^@/, "")
    .replace(/\s+/g, "");
}

async function resolveUserId(name) {
  // 1) Official batch username API
  for (const excludeBanned of [false, true]) {
    const j1 = await getJson(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [name], excludeBannedUsers: excludeBanned }),
      },
      12000,
    );
    if (isOkJson(j1)) {
      const user = (j1.data || []).find(
        (u) => String(u.name || "").toLowerCase() === name.toLowerCase() || String(u.requestedUsername || "").toLowerCase() === name.toLowerCase(),
      ) || (j1.data || [])[0];
      if (user?.id) return { id: user.id, user };
    }
  }

  // 2) Search fallback
  const qs = encodeURIComponent(name);
  const j2 = await getJson(`https://users.roblox.com/v1/users/search?keyword=${qs}&limit=10`, {}, 12000);
  if (isOkJson(j2)) {
    const hit = (j2.data || []).find((u) => String(u.name || "").toLowerCase() === name.toLowerCase());
    if (hit?.id) return { id: hit.id, user: hit };
  }

  return null;
}

export async function lookupRobloxUsername(username) {
  const name = normalizeName(username);
  // Roblox: 3–20 chars, letters/numbers/_ ; allow trailing space already stripped
  if (name.length < 3 || name.length > 20 || !/^[A-Za-z0-9_]+$/.test(name)) {
    return {
      valid: false,
      username: name,
      message: "Invalid Roblox username (3–20 letters, numbers, _ only — not Display Name)",
    };
  }

  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const resolved = await resolveUserId(name);
  if (!resolved) {
    // Distinguish network fail vs not found: try one HEAD-ish request
    const probe = await getJson("https://users.roblox.com/v1/users/1", {}, 8000);
    if (!isOkJson(probe)) {
      return {
        valid: false,
        username: name,
        message: "Roblox lookup unavailable (server blocked or timeout) — try again",
        unavailable: true,
      };
    }
    const value = { valid: false, username: name, message: "User not found" };
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  const id = resolved.id;
  const user = resolved.user || {};

  const [details, thumb, friends, followers, followings] = await Promise.all([
    getJson(`https://users.roblox.com/v1/users/${id}`),
    getJson(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`,
    ),
    getJson(`https://friends.roblox.com/v1/users/${id}/friends/count`),
    getJson(`https://friends.roblox.com/v1/users/${id}/followers/count`),
    getJson(`https://friends.roblox.com/v1/users/${id}/followings/count`),
  ]);

  const det = isOkJson(details) ? details : null;
  if (det?.isBanned) {
    const value = { valid: false, username: name, message: "This Roblox account is banned" };
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  const about = String(det?.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const value = {
    valid: true,
    userId: id,
    username: det?.name || user.name || name,
    displayName: det?.displayName || user.displayName || user.name || name,
    verified: !!(det?.hasVerifiedBadge ?? user.hasVerifiedBadge),
    created: det?.created || null,
    about,
    avatarUrl: (isOkJson(thumb) && thumb?.data?.[0]?.imageUrl) || null,
    friends: num(isOkJson(friends) ? friends : null),
    followers: num(isOkJson(followers) ? followers : null),
    followings: num(isOkJson(followings) ? followings : null),
    profileUrl: `https://www.roblox.com/users/${id}/profile`,
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return value;
}
