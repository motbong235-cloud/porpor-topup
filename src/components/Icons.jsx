import { useState } from "react";

/**
 * Porpor storefront icons — stroke + filled variants for Natsu-style UI.
 */
export function Icon({ name, size = 20 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "icon-svg",
    "aria-hidden": true,
  };

  const n =
    name === "chevron"
      ? "chevR"
      : name === "arrowRight"
        ? "chevR"
        : name === "arrowLeft"
          ? "chevL"
          : name === "arrowUp"
            ? "chevU"
            : name === "arrowDown"
              ? "chevD"
              : name === "support"
                ? "headset"
                : name === "bolt"
                  ? "zap"
                  : name === "box"
                    ? "package"
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
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M14 8H8M16 12H8M13 16H8" />
        </svg>
      );
    case "star":
      /* filled star — matches fa-star on TOP badges */
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="icon-svg" aria-hidden fill="currentColor">
          <path d="M12 2.5 14.6 9.2l7.2.8-5.4 4.8 1.6 7-6-3.4-6 3.4 1.6-7-5.4-4.8 7.2-.8z" />
        </svg>
      );
    case "zap":
      /* filled bolt — matches fa-bolt on TOP UP */
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="icon-svg" aria-hidden fill="currentColor">
          <path d="M13 2.2 4.2 13.5h6.6L9.5 21.8 19.8 9.8h-6.4L13 2.2z" />
        </svg>
      );
    case "game":
      /* gamepad — closer to Natsu category icon */
      return (
        <svg {...props} strokeWidth={1.6}>
          <rect x="2" y="7" width="20" height="12" rx="4" />
          <path d="M8 13h3.2M9.6 11.4v3.2" />
          <circle cx="15.4" cy="11.6" r="1" fill="currentColor" stroke="none" />
          <circle cx="17.8" cy="13.8" r="1" fill="currentColor" stroke="none" />
          <path d="M6 7V5.5a1 1 0 0 1 1-1h2" />
          <path d="M18 7V5.5a1 1 0 0 0-1-1h-2" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props} strokeWidth={1.6}>
          <rect x="3" y="9" width="18" height="12" rx="2" />
          <path d="M12 9v12M3 13h18" />
          <path d="M12 9H7.5a2.5 2.5 0 1 1 0-5C10.5 4 12 9 12 9zM12 9h4.5a2.5 2.5 0 1 0 0-5C13.5 4 12 9 12 9z" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 19.5c1.4-3.2 4-4.6 7-4.6s5.6 1.4 7 4.6" />
        </svg>
      );
    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M3.8 12h16.4M12 3.8a13 13 0 0 1 0 16.4M12 3.8a13 13 0 0 0 0 16.4" />
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
    case "headset":
      return (
        <svg {...props}>
          <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
          <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
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
    case "package":
      return (
        <svg {...props}>
          <path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9L12 3.2z" />
          <path d="M12 12v8.5M20 7.5 12 12 4 7.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M19.5 6.5 9.5 17l-5-5" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M21 3.5 10.5 13" />
          <path d="M21 3.5 14.5 21l-4-7.5L3 9.5 21 3.5z" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M20.5 11.2a7.8 7.8 0 0 1-1.1 4 7.9 7.9 0 0 1-6.7 3.6 7.7 7.7 0 0 1-3.3-.7L3.5 20l1.6-4.8a7.7 7.7 0 0 1-.9-3.6 7.9 7.9 0 0 1 4.2-6.8 7.7 7.7 0 0 1 3.5-.9h.4a7.9 7.9 0 0 1 8.2 8.3z" />
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
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5V12l2.8 1.8" />
        </svg>
      );
    case "copy":
      return (
        <svg {...props}>
          <rect x="9" y="9" width="10.5" height="10.5" rx="2" />
          <path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7" />
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
    case "logout":
      return (
        <svg {...props}>
          <path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10" />
          <path d="M14 12h6.5" />
          <path d="m17.5 8.5 3.5 3.5-3.5 3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="3.5" y="11" width="17" height="10.5" rx="2" />
          <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" />
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
    case "alert":
      return (
        <svg {...props}>
          <path d="M12 9.5v4.5" />
          <path d="M12 17.5h.01" />
          <path d="M10.3 4.8 2.9 18.2A1.8 1.8 0 0 0 4.5 20.8h15a1.8 1.8 0 0 0 1.6-2.6L13.7 4.8a1.8 1.8 0 0 0-3.4 0z" />
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
