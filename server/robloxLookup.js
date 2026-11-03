/**
 * Public Roblox username → profile (no API key)
 * Used to enrich Dino/Khmer check with avatar + display name
 */
export async function lookupRobloxUsername(username) {
  const name = String(username || "").trim().replace(/^@/, "");
  if (name.length < 3) return null;

  const ctrl = AbortSignal.timeout(10000);
  // 1) username → user id
  const r1 = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
    signal: ctrl,
  });
  const j1 = await r1.json().catch(() => ({}));
  const user = (j1.data || [])[0];
  if (!user?.id) {
    return { valid: false, username: name, message: "User not found" };
  }

  // 2) details
  let displayName = user.displayName || user.requestedUsername || name;
  let created = null;
  try {
    const r2 = await fetch(`https://users.roblox.com/v1/users/${user.id}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const j2 = await r2.json().catch(() => ({}));
    if (j2.displayName) displayName = j2.displayName;
    if (j2.created) created = j2.created;
    if (j2.name) user.name = j2.name;
  } catch {
    /* optional */
  }

  // 3) avatar headshot
  let avatarUrl = null;
  try {
    const r3 = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    const j3 = await r3.json().catch(() => ({}));
    avatarUrl = j3.data?.[0]?.imageUrl || null;
  } catch {
    /* optional */
  }

  return {
    valid: true,
    userId: user.id,
    username: user.name || name,
    displayName,
    created,
    avatarUrl,
    profileUrl: `https://www.roblox.com/users/${user.id}/profile`,
  };
}
