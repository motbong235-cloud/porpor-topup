import { Icon } from "./Icons";

const fmt = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
};

/** Roblox account card shown after "Check ID" (avatar, names, verified, join date, stats). */
export default function RobloxProfileCard({ profile, lang = "km" }) {
  if (!profile) return null;
  const d = profile.created ? new Date(profile.created) : null;
  const joined = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";
  const hasStats = profile.friends != null || profile.followers != null || profile.followings != null;
  return (
    <div className="rbx-card">
      <div className="rbx-card-main">
        <div className="rbx-card-avatar">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="rbx-card-noimg">
              <Icon name="user" size={24} />
            </span>
          )}
          <span className="rbx-card-tick" title={lang === "km" ? "រកឃើញគណនី" : "Account found"}>
            <Icon name="check" size={10} />
          </span>
        </div>
        <div className="rbx-card-info">
          <div className="rbx-card-name">
            <span>{profile.displayName || profile.username}</span>
            {profile.verified ? (
              <svg width="14" height="14" viewBox="0 0 24 24" className="rbx-card-verified" role="img" aria-label="Verified">
                <path
                  fill="currentColor"
                  d="M12 1.5l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.2z"
                />
                <path fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M8 12.3l2.6 2.6L16.2 9.3" />
              </svg>
            ) : null}
          </div>
          <div className="rbx-card-user">@{profile.username}</div>
          <div className="rbx-card-sub">
            ID {profile.userId}
            {joined ? ` · ${lang === "km" ? "ចូលរួម" : "Joined"} ${joined}` : ""}
          </div>
        </div>
        {profile.profileUrl ? (
          <a className="rbx-card-link" href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
            Profile <Icon name="external" size={11} />
          </a>
        ) : null}
      </div>
      {profile.about ? <p className="rbx-card-about">{profile.about}</p> : null}
      {hasStats ? (
        <div className="rbx-card-stats">
          <div>
            <b>{fmt(profile.friends)}</b>
            <span>{lang === "km" ? "មិត្ត" : "Friends"}</span>
          </div>
          <div>
            <b>{fmt(profile.followers)}</b>
            <span>{lang === "km" ? "អ្នកតាមដាន" : "Followers"}</span>
          </div>
          <div>
            <b>{fmt(profile.followings)}</b>
            <span>{lang === "km" ? "កំពុងតាមដាន" : "Following"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
