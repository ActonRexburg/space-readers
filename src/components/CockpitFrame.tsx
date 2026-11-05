/**
 * Thin curved windshield around the Bridge scene.
 * Decorative only — pointer-events none so it never blocks taps.
 */
export function CockpitFrame() {
  return (
    <div className="cockpit-frame" aria-hidden="true">
      <svg
        className="cockpit-frame-svg"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
      >
        <path
          className="cockpit-frame-edge"
          d="M 28 22
             Q 500 6 972 22
             L 988 68
             Q 994 300 988 532
             L 972 578
             Q 500 594 28 578
             L 12 532
             Q 6 300 12 68
             Z"
          fill="none"
          stroke="rgba(0,245,255,0.22)"
          strokeWidth="3"
        />
        <path
          className="cockpit-frame-inner"
          d="M 42 36
             Q 500 22 958 36
             L 970 78
             Q 976 300 970 522
             L 958 564
             Q 500 578 42 564
             L 30 522
             Q 24 300 30 78
             Z"
          fill="none"
          stroke="rgba(0,245,255,0.1)"
          strokeWidth="1.4"
        />
      </svg>
      <div className="cockpit-vignette" />
    </div>
  );
}
