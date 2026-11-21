import { useMemo } from "react";

/**
 * Soft golden falling petals / sparkles for Porpor storefront.
 * Original implementation inspired by premium gaming UI motion (not a copy of any site assets).
 */
const PETAL_COUNT = 16;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function FallingPetals() {
  const petals = useMemo(() => {
    return Array.from({ length: PETAL_COUNT }, (_, i) => {
      const size = rand(10, 22);
      const left = rand(2, 96);
      const duration = rand(11, 22);
      const delay = rand(-18, 0);
      const sway = rand(18, 55);
      const swayDur = rand(2.8, 5.2);
      const spinDur = rand(4, 9);
      const opacity = rand(0.35, 0.75);
      const turn = rand(0, 360);
      const depth = i % 4 === 0 ? "near" : "far";
      const mobileLeft = Math.min(92, Math.max(4, left + rand(-8, 8)));
      return {
        id: i,
        style: {
          "--petal-size": `${size}px`,
          "--petal-left": `${left}%`,
          "--petal-mobile-left": `${mobileLeft}%`,
          "--petal-duration": `${duration}s`,
          "--petal-delay": `${delay}s`,
          "--petal-sway": `${sway}px`,
          "--petal-sway-duration": `${swayDur}s`,
          "--petal-spin-duration": `${spinDur}s`,
          "--petal-opacity": opacity,
          "--petal-turn": `${turn}deg`,
        },
        depth,
      };
    });
  }, []);

  return (
    <div className="falling-petals" aria-hidden="true">
      {petals.map((p) => (
        <div key={p.id} className="falling-petal" data-depth={p.depth} style={p.style}>
          <span className="petal-sway">
            <span className="petal-sprite">
              <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
                <path
                  d="M12 2.2c1.8 2.6 4.8 4.4 8 4.6-1.4 2.8-1.6 5.8-.4 8.6-2.8-.6-5.6.2-7.6 2.2-2-2-4.8-2.8-7.6-2.2 1.2-2.8 1-5.8-.4-8.6 3.2-.2 6.2-2 8-4.6z"
                  fill="url(#pp-petal-gold)"
                  opacity="0.92"
                />
                <defs>
                  <linearGradient id="pp-petal-gold" x1="4" y1="3" x2="20" y2="20">
                    <stop stopColor="#5eb0ff" />
                    <stop offset="0.55" stopColor="#1d6adf" />
                    <stop offset="1" stopColor="#E8B84A" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default FallingPetals;
