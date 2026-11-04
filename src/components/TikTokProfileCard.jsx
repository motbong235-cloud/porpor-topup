import { Icon } from "./Icons";

/** TikTok profile/video card after Check Link */
export default function TikTokProfileCard({ profile, lang = "km" }) {
  if (!profile) return null;
  const user = profile.username || "";
  const name = profile.displayName || user;
  const url = profile.authorUrl || (user ? `https://www.tiktok.com/@${user}` : "");
  const video = profile.resolvedUrl || profile.inputUrl || "";
  return (
    <div className="ttk-card rbx-card" style={{ marginTop: 12 }}>
      <div className="rbx-card-main">
        <div className="rbx-card-avatar" style={{ background: "#0f172a", overflow: "hidden" }}>
          {profile.thumbnail ? (
            <img src={profile.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="rbx-card-noimg" style={{ color: "#fff", fontWeight: 800 }}>TT</span>
          )}
          <span className="rbx-card-tick" title={lang === "km" ? "រកឃើញ" : "Found"}>
            <Icon name="check" size={12} />
          </span>
        </div>
        <div className="rbx-card-info">
          <div className="rbx-card-name">
            {name}
          </div>
          {user ? <div className="rbx-card-user">@{user}</div> : null}
          {profile.title ? (
            <div className="rbx-card-sub" style={{ marginTop: 4, opacity: 0.85, fontSize: 12 }}>
              {String(profile.title).slice(0, 80)}
            </div>
          ) : null}
          {url ? (
            <a className="rbx-card-link" href={url} target="_blank" rel="noopener noreferrer">
              {lang === "km" ? "បើក Profile TikTok" : "Open TikTok profile"}
            </a>
          ) : null}
          {video ? (
            <a className="rbx-card-link" href={video} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
              {lang === "km" ? "បើក Video" : "Open video"}
            </a>
          ) : null}
        </div>
      </div>
      <p className="rbx-card-about" style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
        {lang === "km"
          ? "Admin នឹងផ្ញើ likes/views ទៅ @" + (user || "…") + " តាម video នេះ"
          : "Admin will send likes/views to @" + (user || "…") + " on this video"}
      </p>
    </div>
  );
}
