import { useState } from "react";

/**
 * Premium storefront icons — refined geometry, filled accents for Natsu-like UI.
 */
export function Icon({ name, size = 20 }) {
  const stroke = {
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

  const filled = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className: "icon-svg",
    "aria-hidden": true,
  };

  const n =
    name === "chevron" || name === "arrowRight"
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
        <svg {...stroke}>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-3.6-3.6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...stroke}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "x":
      return (
        <svg {...stroke}>
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      );
    case "home":
      return (
        <svg {...filled}>
          <path d="M12 3.2 3.5 10.2V20a1 1 0 0 0 1 1h5v-6h5v6h5a1 1 0 0 0 1-1v-9.8L12 3.2z" />
        </svg>
      );
    case "orders":
      return (
        <svg {...stroke}>
          <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "star":
      return (
        <svg {...filled}>
          <path d="M12 2.4 14.7 9l7.1.8-5.3 4.7 1.6 6.9L12 17.8 5.9 21.4l1.6-6.9L2.2 9.8 9.3 9z" />
        </svg>
      );
    case "zap":
      return (
        <svg {...filled}>
          <path d="M13.2 2.1 4 13.8h6.8L9.2 21.9 20 9.5h-6.6L13.2 2.1z" />
        </svg>
      );
    case "game":
      return (
        <svg {...stroke} strokeWidth={1.7}>
          <rect x="2" y="7.5" width="20" height="11" rx="3.5" />
          <path d="M8 13h3.2M9.6 11.4v3.2" />
          <circle cx="15.3" cy="11.8" r="1.05" fill="currentColor" stroke="none" />
          <circle cx="17.7" cy="13.9" r="1.05" fill="currentColor" stroke="none" />
        </svg>
      );
    case "gift":
      return (
        <svg {...stroke} strokeWidth={1.7}>
          <rect x="3" y="9.5" width="18" height="11.5" rx="2" />
          <path d="M12 9.5v11.5M3 13.5h18" />
          <path d="M12 9.5H7.6a2.4 2.4 0 1 1 0-4.8C10.8 4.7 12 9.5 12 9.5zM12 9.5h4.4a2.4 2.4 0 1 0 0-4.8C13.2 4.7 12 9.5 12 9.5z" />
        </svg>
      );
    case "user":
      return (
        <svg {...filled}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20.2c1.6-3.6 4.6-5.2 7.5-5.2s5.9 1.6 7.5 5.2" />
        </svg>
      );
    case "globe":
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8.3" />
          <path d="M3.7 12h16.6M12 3.7a14 14 0 0 1 0 16.6M12 3.7a14 14 0 0 0 0 16.6" />
        </svg>
      );
    case "download":
      return (
        <svg {...stroke}>
          <path d="M12 4v11.5" />
          <path d="m7.2 11.2 4.8 4.8 4.8-4.8" />
          <path d="M5 20h14" />
        </svg>
      );
    case "headset":
      return (
        <svg {...stroke}>
          <path d="M4 12a8 8 0 0 1 16 0" />
          <path d="M4 12v5a2 2 0 0 0 2 2h1.5a1.5 1.5 0 0 0 1.5-1.5V14a1.5 1.5 0 0 0-1.5-1.5H4" />
          <path d="M20 12v5a2 2 0 0 1-2 2h-1.5a1.5 1.5 0 0 1-1.5-1.5V14a1.5 1.5 0 0 1 1.5-1.5H20" />
          <path d="M20 17.5v1a3.5 3.5 0 0 1-3.5 3.5H12" />
        </svg>
      );
    case "shield":
      return (
        <svg {...stroke}>
          <path d="M12 21.5s7.2-3.3 7.2-9.2V5.8L12 3.2 4.8 5.8v6.5c0 5.9 7.2 9.2 7.2 9.2z" />
          <path d="m9.2 12 2.1 2.1 3.7-3.7" />
        </svg>
      );
    case "file":
      return (
        <svg {...stroke}>
          <path d="M6.5 3.5h8L19 8v11.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
          <path d="M14.5 3.5V8H19M9 13h6M9 16.5h5" />
        </svg>
      );
    case "cookie":
      return (
        <svg {...stroke}>
          <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5 3.5 3.5 0 0 1-3.5-3.5 3.5 3.5 0 0 1-5-5z" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chevL":
      return (
        <svg {...stroke}>
          <path d="M14.5 5.5 8.5 12l6 6.5" />
        </svg>
      );
    case "chevR":
      return (
        <svg {...stroke}>
          <path d="M9.5 5.5 15.5 12l-6 6.5" />
        </svg>
      );
    case "chevU":
      return (
        <svg {...stroke}>
          <path d="M5.5 14.5 12 8.5l6.5 6" />
        </svg>
      );
    case "chevD":
      return (
        <svg {...stroke}>
          <path d="M5.5 9.5 12 15.5l6.5-6" />
        </svg>
      );
    case "package":
      return (
        <svg {...stroke}>
          <path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9L12 3.2z" />
          <path d="M12 12v8.5M20 7.5 12 12 4 7.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...stroke}>
          <path d="M19.5 6.5 9.5 17l-5-5" />
        </svg>
      );
    case "send":
      return (
        <svg {...filled}>
          <path d="M3.2 11.2 20.5 3.5 13 20.5l-2.2-7.2L3.2 11.2z" />
        </svg>
      );
    case "chat":
      return (
        <svg {...stroke}>
          <path d="M20.2 11a7.6 7.6 0 0 1-1 3.8 7.7 7.7 0 0 1-6.5 3.5 7.5 7.5 0 0 1-3.2-.7L3.5 19.5l1.5-4.6a7.5 7.5 0 0 1-.9-3.5 7.7 7.7 0 0 1 4.1-6.6 7.5 7.5 0 0 1 3.4-.9h.4A7.7 7.7 0 0 1 20.2 11z" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...stroke}>
          <path d="M3 8.2h16.2A1.8 1.8 0 0 1 21 10v7.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.2V8.2z" />
          <path d="M3 8.2V6.5A1.8 1.8 0 0 1 4.8 4.7h10.5" />
          <circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "plus":
      return (
        <svg {...stroke}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      );
    case "clock":
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8.3" />
          <path d="M12 7.5V12l2.8 1.9" />
        </svg>
      );
    case "copy":
      return (
        <svg {...stroke}>
          <rect x="9" y="9" width="10.5" height="10.5" rx="2" />
          <path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...stroke}>
          <path d="M20 12a8 8 0 1 1-2.2-5.5" />
          <path d="M20 4.5v5h-5" />
        </svg>
      );
    case "trash":
      return (
        <svg {...stroke}>
          <path d="M4.5 7h15" />
          <path d="M9.5 7V5.3A1.3 1.3 0 0 1 10.8 4h2.4a1.3 1.3 0 0 1 1.3 1.3V7" />
          <path d="M7 7l.8 12.3A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.2L17 7" />
        </svg>
      );
    case "logout":
      return (
        <svg {...stroke}>
          <path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10" />
          <path d="M14 12h6.5" />
          <path d="m17.5 8.5 3.5 3.5-3.5 3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.8v2.2M12 19v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.8 12h2.2M19 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...stroke}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
        </svg>
      );
    case "image":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m3.5 16.5 4.5-4 3.5 3 3-2.5 6 5.5" />
        </svg>
      );
    case "alert":
      return (
        <svg {...stroke}>
          <path d="M12 9.5v4.5M12 17.5h.01" />
          <path d="M10.3 4.8 2.9 18.2A1.8 1.8 0 0 0 4.5 20.8h15a1.8 1.8 0 0 0 1.6-2.6L13.7 4.8a1.8 1.8 0 0 0-3.4 0z" />
        </svg>
      );
    case "cart":
      return (
        <svg {...stroke}>
          <circle cx="9" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
          <path d="M3.5 4.5h2.2l2.1 10.5a1.6 1.6 0 0 0 1.6 1.3h7.8a1.6 1.6 0 0 0 1.6-1.2L20.5 8H7" />
        </svg>
      );
    case "bell":
      return (
        <svg {...stroke}>
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5.8 2.3 7 2.3 7H4.2s2.3-1.2 2.3-7" />
          <path d="M10.3 20a1.7 1.7 0 0 0 3.4 0" />
        </svg>
      );
    case "flame":
      return (
        <svg {...filled}>
          <path d="M12 2.5c1.5 2.8 4.2 4.5 4.2 8.2a4.2 4.2 0 0 1-8.4 0c0-2.2.9-3.8 2.2-5.2C11 4.2 12 2.5 12 2.5z" />
          <path d="M12 14.5a2 2 0 0 0 2-2c0-1.2-.7-2-1.3-2.8-.4 1.2-1.2 2-2 2.5.2 1.3 1.3 2.3 1.3 2.3z" fill="#100a08" opacity="0.35" />
        </svg>
      );
    case "crown":
      return (
        <svg {...filled}>
          <path d="M4 17.5h16l-1.2-9.5L14.5 12 12 5.5 9.5 12 5.2 8 4 17.5z" />
          <path d="M5 19.5h14" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      );
    case "gem":
      return (
        <svg {...stroke}>
          <path d="M6 4.5h12l4 6.5-10 12L2 11z" />
          <path d="M2 11h20M10.5 4.5 8 11l4 12 4-12-2.5-6.5" />
        </svg>
      );
    case "percent":
      return (
        <svg {...stroke}>
          <path d="M19 5 5 19" />
          <circle cx="7" cy="7" r="2.5" />
          <circle cx="17" cy="17" r="2.5" />
        </svg>
      );
    case "external":
      return (
        <svg {...stroke}>
          <path d="M8 16.5 16.5 8" />
          <path d="M9.5 8H16.5v7" />
        </svg>
      );
    case "pin":
      return (
        <svg {...stroke}>
          <path d="M12 16.5V21" />
          <path d="M8.5 3.5h7l-1 5.5 2.8 3.8H6.7L9.5 9 8.5 3.5z" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...stroke}>
          <path d="M3.5 9a1.8 1.8 0 0 0 1.8-1.8V5.5A1.8 1.8 0 0 1 7.1 3.7h9.8a1.8 1.8 0 0 1 1.8 1.8v1.7a1.8 1.8 0 1 0 0 3.6v1.7a1.8 1.8 0 0 1-1.8 1.8H7.1a1.8 1.8 0 0 1-1.8-1.8v-1.7a1.8 1.8 0 0 0-1.8-1.8z" />
        </svg>
      );
    case "video":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
          <path d="m15.5 10.5 5-2.5v8l-5-2.5" />
        </svg>
      );
    case "camera":
      return (
        <svg {...stroke}>
          <path d="M4.5 8.5h3l1.5-2h6l1.5 2H19.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5z" />
          <circle cx="12" cy="14" r="3.2" />
        </svg>
      );
    case "upload":
      return (
        <svg {...stroke}>
          <path d="M12 16V5" />
          <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "note":
      return (
        <svg {...stroke}>
          <rect x="8" y="2.5" width="8" height="4" rx="1" />
          <path d="M16 4.5h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
        </svg>
      );
    case "services":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
          <rect x="13" y="10" width="7.5" height="10.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      );
    case "tag":
      return (
        <svg {...stroke}>
          <path d="M20 13.2 12 21.2 3.5 12.7 11.7 4.5a1.8 1.8 0 0 1 1.3-.5H19.5v6a1.8 1.8 0 0 1-.5 1.2z" />
          <circle cx="16" cy="8" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      );
    case "qr":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
          <path d="M14 14h2.5v2.5M19.5 14v5.5M14 19.5h2.5" />
        </svg>
      );
    case "badge":
      return (
        <svg {...stroke}>
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path d="m9 12 2 2 4-4" />
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
