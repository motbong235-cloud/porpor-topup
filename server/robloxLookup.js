/**
 * Public Roblox username → profile (no API key)
 * Returns avatar, display name, verified badge, join date, about text and
 * friends / followers / following counts — shown in the "Check ID" card.
 */

const CACHE_MS = 60_000;
const cache = new Map(); // lowercased username → { at, value }

async function getJson(url, init = {}, timeoutMs = 8000) {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

const num = (j) => (j && Number.isFinite(Number(j.count)) ? Number(j.count) : null);

export async function lookupRobloxUsername(username) {
  const name = String(username || "").trim().replace(/^@/, "");
  if (name.length < 3 || name.length > 20 || !/^[A-Za-z0-9_]+$/.test(name)) {
    return { valid: false, username: name, message: "Invalid Roblox username" };
  }

  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  // 1) username → user id
  const j1 = await getJson(
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
    },
    10000,
  );
  if (!j1) {
    // Roblox unreachable / rate limited — let the caller decide (do not cache)
    return { valid: false, username: name, message: "Roblox lookup unavailable", unavailable: true };
  }
  const user = (j1.data || [])[0];
  if (!user?.id) {
    const value = { valid: false, username: name, message: "User not found" };
    cache.set(key, { at: Date.now(), value });
    return value;
  }
  const id = user.id;

  // 2) details + avatar + counts in parallel (all optional)
  const [details, thumb, friends, followers, followings] = await Promise.all([
    getJson(`https://users.roblox.com/v1/users/${id}`),
    getJson(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`,
    ),
    getJson(`https://friends.roblox.com/v1/users/${id}/friends/count`),
    getJson(`https://friends.roblox.com/v1/users/${id}/followers/count`),
    getJson(`https://friends.roblox.com/v1/users/${id}/followings/count`),
  ]);

  if (details?.isBanned) {
    const value = { valid: false, username: name, message: "This Roblox account is banned" };
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  const about = String(details?.description || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const value = {
    valid: true,
    userId: id,
    username: details?.name || user.name || name,
    displayName: details?.displayName || user.displayName || user.name || name,
    verified: !!(details?.hasVerifiedBadge ?? user.hasVerifiedBadge),
    created: details?.created || null,
    about,
    avatarUrl: thumb?.data?.[0]?.imageUrl || null,
    friends: num(friends),
    followers: num(followers),
    followings: num(followings),
    profileUrl: `https://www.roblox.com/users/${id}/profile`,
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}
