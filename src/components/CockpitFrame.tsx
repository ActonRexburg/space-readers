/**
 * Spaceship cockpit interior: curved windshield, beveled corner struts,
 * canopy rim, and a lip that meets the dashboard. Decorative only —
 * pointer-events none so it never blocks taps.
 */
export function CockpitFrame() {
  return (
    <div className="cockpit-frame" aria-hidden="true">
      <svg
        className="cockpit-frame-svg"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cockpit-hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4d63" />
            <stop offset="18%" stopColor="#1c2838" />
            <stop offset="55%" stopColor="#101820" />
            <stop offset="100%" stopColor="#070b12" />
          </linearGradient>
          <linearGradient id="cockpit-strut" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a1018" />
            <stop offset="22%" stopColor="#4a6278" />
            <stop offset="50%" stopColor="#1a2836" />
            <stop offset="78%" stopColor="#5a7388" />
            <stop offset="100%" stopColor="#0c141e" />
          </linearGradient>
          <linearGradient id="cockpit-strut-r" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#0a1018" />
            <stop offset="22%" stopColor="#4a6278" />
            <stop offset="50%" stopColor="#1a2836" />
            <stop offset="78%" stopColor="#5a7388" />
            <stop offset="100%" stopColor="#0c141e" />
          </linearGradient>
          <linearGradient id="cockpit-canopy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a738c" />
            <stop offset="35%" stopColor="#243044" />
            <stop offset="100%" stopColor="#101820" />
          </linearGradient>
          <linearGradient id="cockpit-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9efce8" stopOpacity="0.12" />
            <stop offset="18%" stopColor="#00f5ff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#041018" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cockpit-dash-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6a849c" />
            <stop offset="18%" stopColor="#2a3c50" />
            <stop offset="100%" stopColor="#121a26" />
          </linearGradient>
        </defs>

        <path
          fill="url(#cockpit-hull)"
          fillRule="evenodd"
          d="M0 0 H1000 V600 H0 Z
             M 108 58
             Q 500 18 892 58
             L 948 118
             Q 972 300 948 478
             L 892 538
             Q 500 572 108 538
             L 52 478
             Q 28 300 52 118
             Z"
        />

        <path
          fill="url(#cockpit-glass)"
          d="M 108 58
             Q 500 18 892 58
             L 948 118
             Q 972 300 948 478
             L 892 538
             Q 500 572 108 538
             L 52 478
             Q 28 300 52 118
             Z"
        />

        <path
          d="M 108 58
             Q 500 18 892 58
             L 948 118
             Q 972 300 948 478
             L 892 538
             Q 500 572 108 538
             L 52 478
             Q 28 300 52 118
             Z"
          fill="none"
          stroke="rgba(0,245,255,0.28)"
          strokeWidth="2.2"
        />
        <path
          d="M 128 76
             Q 500 40 872 76
             L 922 128
             Q 944 300 922 462
             L 872 516
             Q 500 548 128 516
             L 78 462
             Q 56 300 78 128
             Z"
          fill="none"
          stroke="rgba(0,245,255,0.1)"
          strokeWidth="1.2"
        />

        <path
          fill="url(#cockpit-canopy)"
          d="M 0 0 H1000 L 930 62 Q 500 14 70 62 Z"
        />
        <path
          d="M 70 62 Q 500 14 930 62"
          fill="none"
          stroke="rgba(224,253,255,0.28)"
          strokeWidth="1.6"
        />
        <path
          d="M 90 48 Q 500 8 910 48"
          fill="none"
          stroke="rgba(0,245,255,0.18)"
          strokeWidth="1.2"
        />

        <path
          fill="url(#cockpit-strut)"
          d="M 0 0 L 118 0 L 78 92 L 48 520 L 70 600 L 0 600 Z"
        />
        <path
          d="M 92 8 L 70 96 L 44 518"
          fill="none"
          stroke="rgba(224,253,255,0.22)"
          strokeWidth="2"
        />
        <path
          d="M 18 12 L 8 590"
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="6"
        />

        <path
          fill="url(#cockpit-strut-r)"
          d="M 1000 0 L 882 0 L 922 92 L 952 520 L 930 600 L 1000 600 Z"
        />
        <path
          d="M 908 8 L 930 96 L 956 518"
          fill="none"
          stroke="rgba(224,253,255,0.22)"
          strokeWidth="2"
        />
        <path
          d="M 982 12 L 992 590"
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="6"
        />

        <path
          fill="url(#cockpit-dash-lip)"
          d="M 48 520 L 70 600 H 930 L 952 520
             Q 500 558 48 520 Z"
        />
        <path
          d="M 70 532 Q 500 566 930 532"
          fill="none"
          stroke="rgba(0,245,255,0.22)"
          strokeWidth="1.6"
        />
        <path
          d="M 90 548 Q 500 578 910 548"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        <circle cx="36" cy="36" r="4" fill="#1a2836" stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
        <circle cx="964" cy="36" r="4" fill="#1a2836" stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
        <circle cx="28" cy="560" r="4" fill="#1a2836" stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
        <circle cx="972" cy="560" r="4" fill="#1a2836" stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
      </svg>
      <div className="cockpit-vignette" />
    </div>
  );
}
