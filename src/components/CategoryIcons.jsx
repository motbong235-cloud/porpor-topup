/** Premium category icons for Porpor — filled, detailed, gold-ready */

export function GameIcon({ size = 40, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id="pp-game-body" x1="8" y1="12" x2="40" y2="38">
          <stop stopColor="#FFE08A" />
          <stop offset="0.45" stopColor="#F2A51A" />
          <stop offset="1" stopColor="#C8860E" />
        </linearGradient>
        <linearGradient id="pp-game-face" x1="12" y1="16" x2="36" y2="34">
          <stop stopColor="#2A2624" />
          <stop offset="1" stopColor="#1A1715" />
        </linearGradient>
        <linearGradient id="pp-game-btn" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFD447" />
          <stop offset="1" stopColor="#F2A51A" />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="6" y="14" width="36" height="22" rx="8" fill="url(#pp-game-body)" />
      <rect x="9" y="17" width="30" height="16" rx="5" fill="url(#pp-game-face)" />
      {/* D-pad */}
      <path
        d="M15 22.5h3.5v-3.5h3v3.5H25v3h-3.5V29h-3v-3.5H15v-3z"
        fill="url(#pp-game-btn)"
        opacity="0.95"
      />
      {/* action buttons */}
      <circle cx="31" cy="22" r="2.2" fill="url(#pp-game-btn)" />
      <circle cx="35.5" cy="25.5" r="2.2" fill="url(#pp-game-btn)" />
      <circle cx="31" cy="29" r="2.2" fill="url(#pp-game-btn)" opacity="0.75" />
      <circle cx="26.5" cy="25.5" r="2.2" fill="url(#pp-game-btn)" opacity="0.75" />
      {/* grips */}
      <path d="M6 20c-2 1-3.5 3-3.5 5.5S4 31 6 32" stroke="#C8860E" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 20c2 1 3.5 3 3.5 5.5S44 31 42 32" stroke="#C8860E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function GiftIcon({ size = 40, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id="pp-gift-box" x1="8" y1="18" x2="40" y2="42">
          <stop stopColor="#FFE08A" />
          <stop offset="0.5" stopColor="#F2A51A" />
          <stop offset="1" stopColor="#C8860E" />
        </linearGradient>
        <linearGradient id="pp-gift-lid" x1="8" y1="12" x2="40" y2="22">
          <stop stopColor="#FFD447" />
          <stop offset="1" stopColor="#E89A12" />
        </linearGradient>
        <linearGradient id="pp-gift-ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFF4D0" />
          <stop offset="1" stopColor="#F2A51A" />
        </linearGradient>
      </defs>
      {/* box */}
      <rect x="8" y="20" width="32" height="20" rx="3" fill="url(#pp-gift-box)" />
      {/* lid */}
      <rect x="6" y="15" width="36" height="8" rx="2.5" fill="url(#pp-gift-lid)" />
      {/* vertical ribbon */}
      <rect x="21" y="15" width="6" height="25" rx="1" fill="url(#pp-gift-ribbon)" opacity="0.9" />
      {/* horizontal ribbon */}
      <rect x="8" y="22" width="32" height="5" rx="1" fill="url(#pp-gift-ribbon)" opacity="0.85" />
      {/* bow left */}
      <path
        d="M24 15c-4-5-9-6-11-3 0 3 4 5 11 5"
        fill="#FFD447"
        stroke="#C8860E"
        strokeWidth="0.8"
      />
      {/* bow right */}
      <path
        d="M24 15c4-5 9-6 11-3 0 3-4 5-11 5"
        fill="#FFD447"
        stroke="#C8860E"
        strokeWidth="0.8"
      />
      {/* bow center */}
      <circle cx="24" cy="14.5" r="2.5" fill="#FFF4D0" stroke="#C8860E" strokeWidth="0.7" />
    </svg>
  );
}
