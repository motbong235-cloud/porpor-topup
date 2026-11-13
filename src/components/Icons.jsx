import { useState } from "react";

/**
 * Porpor storefront icons — stroke style matched to navy/blue UI.
 * stroke ~1.9, round caps; arrows use consistent chevron geometry.
 */
export function Icon({ name, size = 20 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "icon-svg",
    "aria-hidden": true,
  };

  // normalize aliases
  const n = name === "chevron" ? "chevR"
    : name === "arrowRight" ? "chevR"
    : name === "arrowLeft" ? "chevL"
    : name === "arrowUp" ? "chevU"
    : name === "arrowDown" ? "chevD"
    : name === "support" ? "help"
    : name === "bolt" ? "zap"
    : name === "box" ? "package"
    : name;

  switch (n) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.75" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M20.5 13.2A8.2 8.2 0 1 1 10.8 3.5 6.4 6.4 0 0 0 20.5 13.2z" />
        </svg>
      );
    case "x":
      return (
        <svg {...props}>
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      );
    case "home":
      return (
        <svg {...props}>
          <path d="m4 11 8-7.5 8 7.5" />
          <path d="M6.5 10.5V19a1 1 0 0 0 1 1H10v-5h4v5h2.5a1 1 0 0 0 1-1v-8.5" />
        </svg>
      );
    case "orders":
      return (
        <svg {...props}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M5 6h.01M5 12h.01M5 18h.01" />
        </svg>
      );
    case "help":
      return (
        <svg {...props}>
          <path d="M4 15.5v-4a8 8 0 1 1 16 0v4" />
          <path d="M19.5 18.5a1.8 1.8 0 0 1-1.8 1.8H16v-5h3.5v3.2zM4.5 18.5a1.8 1.8 0 0 0 1.8 1.8H8v-5H4.5v3.2z" />
        </svg>
      );
    case "store":
      return (
        <svg {...props}>
          <path d="M3.5 9.5 5 5h14l1.5 4.5" />
          <path d="M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" />
          <path d="M9.5 20v-7h5v7" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6.2 2.5 7.5 2.5 7.5H4S6.5 15.2 6.5 9" />
          <path d="M10.2 20a1.8 1.8 0 0 0 3.6 0" />
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="icon-svg" aria-hidden fill="currentColor">
          <path d="M12 3.2 14.5 9l6 .7-4.5 4.1 1.3 5.8L12 16.6 6.7 19.6 8 13.8 3.5 9.7 9.5 9z" />
        </svg>
      );
    case "chevL":
      return (
        <svg {...props}>
          <path d="M14.5 5.5 8.5 12l6 6.5" />
        </svg>
      );
    case "chevR":
      return (
        <svg {...props}>
          <path d="M9.5 5.5 15.5 12l-6 6.5" />
        </svg>
      );
    case "chevU":
      return (
        <svg {...props}>
          <path d="M5.5 14.5 12 8.5l6.5 6" />
        </svg>
      );
    case "chevD":
      return (
        <svg {...props}>
          <path d="M5.5 9.5 12 15.5l6.5-6" />
        </svg>
      );
    case "package":
      return (
        <svg {...props}>
          <path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9L12 3.2z" />
          <path d="M12 12v8.5M20 7.5 12 12 4 7.5" />
        </svg>
      );
    case "game":
      return (
        <svg {...props}>
          <rect x="2.5" y="7" width="19" height="11" rx="3.5" />
          <path d="M8 12.5h3.5M9.75 10.75v3.5" />
          <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "zap":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="icon-svg" aria-hidden fill="currentColor">
          <path d="M13 2.5 4.5 13.5H11l-1 8 9.5-12H13z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M19.5 6.5 9.5 17l-5-5" />
        </svg>
      );
    case "badge":
      return (
        <svg {...props}>
          <path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5z" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M21 3.5 10.5 13" />
          <path d="M21 3.5 14.5 21l-4-7.5L3 9.5 21 3.5z" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 4v11" />
          <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M20.5 11.2a7.8 7.8 0 0 1-1.1 4 7.9 7.9 0 0 1-6.7 3.6 7.7 7.7 0 0 1-3.3-.7L3.5 20l1.6-4.8a7.7 7.7 0 0 1-.9-3.6 7.9 7.9 0 0 1 4.2-6.8 7.7 7.7 0 0 1 3.5-.9h.4a7.9 7.9 0 0 1 8.2 8.3z" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props}>
          <rect x="3.5" y="8.5" width="17" height="12" rx="1.8" />
          <path d="M12 8.5v12M3.5 12.5h17" />
          <path d="M12 8.5H8a2.3 2.3 0 1 1 0-4.6C11 3.9 12 8.5 12 8.5zM12 8.5h4a2.3 2.3 0 1 0 0-4.6C13 3.9 12 8.5 12 8.5z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
      );
    case "qr":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
          <path d="M14 14h2.5v2.5M19.5 14v5.5M14 19.5h2.5" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M20 13.2 12 21.2 3.5 12.7 11.7 4.5a1.8 1.8 0 0 1 1.3-.5H19.5v6a1.8 1.8 0 0 1-.5 1.2z" />
          <circle cx="16" cy="8" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 19.5c1.4-3.2 4-4.6 7-4.6s5.6 1.4 7 4.6" />
        </svg>
      );
    case "cart":
      return (
        <svg {...props}>
          <circle cx="9" cy="19.5" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="19.5" r="1.35" fill="currentColor" stroke="none" />
          <path d="M3.5 4.5h2l2 10.2a1.7 1.7 0 0 0 1.7 1.4h7.6a1.7 1.7 0 0 0 1.7-1.3L20.5 8H7.2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5V12l2.8 1.8" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...props}>
          <path d="M3.5 9a1.8 1.8 0 0 0 1.8-1.8V5.5A1.8 1.8 0 0 1 7.1 3.7h9.8a1.8 1.8 0 0 1 1.8 1.8v1.7a1.8 1.8 0 1 0 0 3.6v1.7a1.8 1.8 0 0 1-1.8 1.8H7.1a1.8 1.8 0 0 1-1.8-1.8v-1.7a1.8 1.8 0 0 0-1.8-1.8z" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M3 8h16.5A1.8 1.8 0 0 1 21.3 9.8v7.4a1.8 1.8 0 0 1-1.8 1.8H4.5A1.8 1.8 0 0 1 2.7 17.2V8z" />
          <path d="M3 8V6.2A1.8 1.8 0 0 1 4.8 4.4h11" />
          <circle cx="16.8" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      );
    case "external":
      return (
        <svg {...props}>
          <path d="M8 16.5 16.5 8" />
          <path d="M9.5 8H16.5v7" />
        </svg>
      );
    case "pin":
      return (
        <svg {...props}>
          <path d="M12 16.5V21" />
          <path d="M8.5 3.5h7l-1 5.5 2.8 3.8H6.7L9.5 9 8.5 3.5z" />
        </svg>
      );
    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M3.8 12h16.4M12 3.8a13 13 0 0 1 0 16.4M12 3.8a13 13 0 0 0 0 16.4" />
        </svg>
      );
    case "copy":
      return (
        <svg {...props}>
          <rect x="9" y="9" width="10.5" height="10.5" rx="2" />
          <path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7" />
        </svg>
      );
    case "file":
      return (
        <svg {...props}>
          <path d="M6.5 3.5h8.2L19 7.8V20a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
          <path d="M14.5 3.5V8H19M9 13h6.5M9 16.5h6.5" />
        </svg>
      );
    case "cookie":
      return (
        <svg {...props}>
          <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5 3.6 3.6 0 0 1-3.6-3.6 3.6 3.6 0 0 1-4.9-4.9z" />
          <path d="M9 12h.01M13 15.5h.01M8.5 15.5h.01" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 12a8 8 0 1 1-2.2-5.5" />
          <path d="M20 4.5v5h-5" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M4.5 7h15" />
          <path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
          <path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" />
        </svg>
      );
    case "upload":
      return (
        <svg {...props}>
          <path d="M12 16V5" />
          <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "camera":
      return (
        <svg {...props}>
          <path d="M4.5 8.5h3l1.5-2h6l1.5 2H19.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5z" />
          <circle cx="12" cy="14" r="3.2" />
        </svg>
      );
    case "alert":
      return (
        <svg {...props}>
          <path d="M12 9.5v4.5" />
          <path d="M12 17.5h.01" />
          <path d="M10.3 4.8 2.9 18.2A1.8 1.8 0 0 0 4.5 20.8h15a1.8 1.8 0 0 0 1.6-2.6L13.7 4.8a1.8 1.8 0 0 0-3.4 0z" />
        </svg>
      );
    case "image":
      return (
        <svg {...props}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m3.5 16.5 4.5-4 3.5 3 3-2.5 6 5.5" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10" />
          <path d="M14 12h6.5" />
          <path d="m17.5 8.5 3.5 3.5-3.5 3.5" />
        </svg>
      );
    case "video":
      return (
        <svg {...props}>
          <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
          <path d="m15.5 10.5 5-2.5v8l-5-2.5" />
        </svg>
      );
    case "note":
      return (
        <svg {...props}>
          <path d="M6.5 3.5h9L19 7v13a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
          <path d="M15 3.5V7h3.5M8.5 12h7M8.5 15.5h5" />
        </svg>
      );
    case "services":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
          <rect x="13" y="10" width="7.5" height="10.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
        </svg>
      );
    default:
      return null;
  }
}

function fallbackIcon(game) {
  const k = `${game?.id || ""} ${game?.name || ""}`.toLowerCase();
  if (/gift|gc|card/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-gift.svg";
  if (/plus|premium/.test(k) && /roblox|rbx/.test(k)) return "/icons/roblox-plus.svg";
  if (/robux|login/.test(k)) return "/icons/robux.svg";
  if (/roblox|rbx/.test(k)) return "/icons/roblox.svg";
  if (/mlbb|mobile.?legends|\bml\b/.test(k)) return "/icons/mlbb.svg";
  return "";
}

export function GameTile({ game, className = "" }) {
  const [broken, setBroken] = useState(false);
  const src = (!broken && game.image) || fallbackIcon(game) || "";
  return (
    <div className={`game-tile ${className}`} style={{ "--h": game.hue }} aria-hidden>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="tile-mark">{game.mark || "·"}</span>
      )}
    </div>
  );
}
