import { useMemo } from "react";
import "./RobuxCelebration.css";

/** Small, transparent Robux-style celebration coins. Decorative only. */
export default function RobuxCelebration({ count = 8 }) {
  const coins = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(12, count)) }, (_, i) => ({
      id: i,
      left: `${7 + ((i * 17) % 86)}%`,
      delay: `${(i % 6) * -0.55}s`,
      duration: `${4.8 + (i % 4) * 0.7}s`,
      size: `${15 + (i % 3) * 4}px`,
      drift: `${(i % 2 ? 1 : -1) * (10 + (i % 4) * 5)}px`,
    })),
    [count],
  );

  return (
    <div className="pp-robux-celebration" aria-hidden="true">
      {coins.map((coin) => (
        <span
          className="pp-robux-coin"
          key={coin.id}
          style={{
            left: coin.left,
            animationDelay: coin.delay,
            animationDuration: coin.duration,
            width: coin.size,
            height: coin.size,
            "--pp-coin-drift": coin.drift,
          }}
        >
          <svg viewBox="0 0 40 40" width="100%" height="100%" focusable="false">
            <path d="M12 2.8h16L37.2 12v16L28 37.2H12L2.8 28V12z" fill="#fbbf24" stroke="#a16207" strokeWidth="2.4" />
            <path d="M13.2 7.2h13.6l6 6v13.6l-6 6H13.2l-6-6V13.2z" fill="#fde68a" stroke="#fff7cc" strokeWidth="1.5" />
            <path d="M15 13h11v14H15z" fill="#111827" />
            <path d="M18 16h5v8h-5z" fill="#f8fafc" />
          </svg>
        </span>
      ))}
    </div>
  );
}
