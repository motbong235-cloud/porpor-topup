import { useMemo } from "react";

/** Clean gold Robux coins falling — no image, no black square bg */
function CoinSvg() {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id="rbxGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* outer hex */}
      <path
        d="M12 2.8h16L37.2 12v16L28 37.2H12L2.8 28V12z"
        fill="url(#rbxGold)"
        stroke="#b45309"
        strokeWidth="2"
      />
      {/* inner hex highlight */}
      <path
        d="M13.2 7.2h13.6l6 6v13.6l-6 6H13.2l-6-6V13.2z"
        fill="#fef3c7"
        stroke="#fcd34d"
        strokeWidth="1.2"
        opacity="0.95"
      />
      {/* R letter — soft dark, not pure black block */}
      <path
        d="M15.2 13.2h7.2c2.4 0 4 1.2 4 3.2 0 1.5-.8 2.6-2.2 3.1l2.6 5.3h-3.1l-2.3-4.8H18v4.8h-2.8V13.2zm2.8 2.2v3.2h4c1.1 0 1.7-.5 1.7-1.6s-.6-1.6-1.7-1.6h-4z"
        fill="#78350f"
      />
    </svg>
  );
}

export default function RobuxRain({ count = 14 }) {
  const coins = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${(i * 37 + 11) % 100}%`,
      delay: `${(i * 0.42) % 5.5}s`,
      duration: `${6.5 + (i % 5) * 0.9}s`,
      size: 20 + (i % 4) * 5,
      drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 5),
      opacity: 0.55 + (i % 4) * 0.1,
    }));
  }, [count]);

  return (
    <div className="robux-rain" aria-hidden="true">
      {coins.map((c) => (
        <span
          key={c.id}
          className="robux-rain-coin"
          style={{
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
            width: c.size,
            height: c.size,
            opacity: c.opacity,
            ["--drift"]: `${c.drift}px`,
          }}
        >
          <CoinSvg />
        </span>
      ))}
    </div>
  );
}
