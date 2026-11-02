import { useMemo } from "react";

/** Falling Robux coins with soft shadow — decorative only */
export default function RobuxRain({ count = 18 }) {
  const coins = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${(i * 37 + 11) % 100}%`,
      delay: `${(i * 0.35) % 6}s`,
      duration: `${7 + (i % 5)}s`,
      size: 22 + (i % 5) * 6,
      drift: (i % 2 === 0 ? 1 : -1) * (8 + (i % 4) * 4),
      opacity: 0.45 + (i % 5) * 0.1,
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
          <img src="/icons/robux-coin.webp" alt="" draggable={false} />
        </span>
      ))}
    </div>
  );
}
