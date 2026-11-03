/**
 * Animated Starfield Background
 * 
 * Multi-layer parallax starfield with a slow twinkle.
 * Durations live in --motion-starfield-* / --motion-twinkle (index.css).
 * Performance optimized for old Chromebooks using CSS transforms.
 * Respects prefers-reduced-motion.
 */

export function Starfield() {
  return (
    <div className="starfield-container" aria-hidden="true">
      <div className="starfield-layer-1" />
      <div className="starfield-layer-2" />
      <div className="starfield-layer-3" />
    </div>
  );
}
