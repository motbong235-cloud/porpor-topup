import { Icon } from "./Icons";

/** Premium TikTok profile card after Check Link */
export default function TikTokProfileCard({ profile, lang = "km" }) {
  if (!profile) return null;
  const user = profile.username || "";
  const name = profile.displayName || user || "TikTok";
  const url = profile.authorUrl || (user ? `https://www.tiktok.com/@${user}` : "");
  const video = profile.resolvedUrl || profile.inputUrl || "";
  const avatar = profile.avatarUrl || "";
  const cover = profile.thumbnail || "";
  const initial = (name || user || "T").charAt(0).toUpperCase();

  return (
    <div className="ttk-card" role="status" aria-live="polite">
      <div className="ttk-card-banner">
        {cover ? (
          <img className="ttk-card-banner-img" src={cover} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="ttk-card-banner-fallback" />
        )}
        <div className="ttk-card-banner-fade" />
        <span className="ttk-card-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3 6.34 6.34 0 0 0 9.5 21.64a6.34 6.34 0 0 0 6.34-6.34V8.75a8.27 8.27 0 0 0 4.84 1.55V6.9a4.85 4.85 0 0 1-1.09-.21z"
            />
          </svg>
          TikTok
        </span>
      </div>

      <div className="ttk-card-body">
        <div className="ttk-card-avatar-wrap">
          {avatar ? (
            <img
              className="ttk-card-avatar"
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fb = e.currentTarget.nextElementSibling;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="ttk-card-avatar ttk-card-avatar-fallback"
            style={{ display: avatar ? "none" : "flex" }}
            aria-hidden
          >
            {cover && !avatar ? (
              <img src={cover} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <span className="ttk-card-ok" title={lang === "km" ? "រកឃើញ profile" : "Profile found"}>
            <Icon name="check" size={11} />
          </span>
        </div>

        <div className="ttk-card-meta">
          <div className="ttk-card-name-row">
            <strong className="ttk-card-name">{name}</strong>
          </div>
          {user ? <div className="ttk-card-user">@{user}</div> : null}
          {profile.title ? (
            <p className="ttk-card-title">{String(profile.title).slice(0, 100)}</p>
          ) : null}
        </div>
      </div>

      <div className="ttk-card-actions">
        {url ? (
          <a className="ttk-card-btn" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name="user" size={14} />
            {lang === "km" ? "Profile" : "Profile"}
          </a>
        ) : null}
        {video ? (
          <a className="ttk-card-btn ttk-card-btn-primary" href={video} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={14} />
            {lang === "km" ? "Video" : "Video"}
          </a>
        ) : null}
      </div>

      <p className="ttk-card-hint">
        {lang === "km"
          ? `Admin នឹងផ្ញើ likes/views ទៅ @${user || "…"} តាម video នេះ`
          : `Admin will send likes/views to @${user || "…"} on this video`}
      </p>
    </div>
  );
}
