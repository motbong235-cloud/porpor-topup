import { useState } from "react";

export function Icon({ name, size = 20 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    className: "icon-svg",
  };
  switch (name) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props} strokeWidth={2.4}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "x":
      return (
        <svg {...props} strokeWidth={2.4}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "home":
      return (
        <svg {...props} strokeWidth={2}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "orders":
      return (
        <svg {...props} strokeWidth={2}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "help":
      return (
        <svg {...props} strokeWidth={2}>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4zM3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
        </svg>
      );
    case "store":
      return (
        <svg {...props} strokeWidth={2}>
          <path d="M3 9l1-4h16l1 4" />
          <path d="M4 9v11h16V9" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="icon-svg">
          <path d="M12 2.6l2.78 5.64 6.22.9-4.5 4.39 1.06 6.19L12 16.9l-5.56 2.92 1.06-6.19L3 9.14l6.22-.9z" />
        </svg>
      );
    case "chevL":
      return (
        <svg {...props} strokeWidth={2.4}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "chevR":
      return (
        <svg {...props} strokeWidth={2.4}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
    case "package":
      return (
        <svg {...props} strokeWidth={2}>
          <rect x="3" y="3" width="18" height="5" rx="1.2" />
          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
          <path d="M10 12h4" />
        </svg>
      );
    case "game":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="icon-svg">
          <path d="M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5l1.4-1.4A2 2 0 0 1 8.3 16h7.4a2 2 0 0 1 1.4.6L18.5 18H21a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
        </svg>
      );
    case "zap":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="icon-svg">
          <path d="M13 2 3 14h7l-1 8 11-13h-7z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props} strokeWidth={2.4}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "badge":
      return (
        <svg {...props} strokeWidth={2}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

export function GameTile({ game, className = "" }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`game-tile ${className}`} style={{ "--h": game.hue }} aria-hidden>
      {game.image && !broken ? (
        <img
          src={game.image}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="tile-mark">{game.mark}</span>
      )}
    </div>
  );
}
