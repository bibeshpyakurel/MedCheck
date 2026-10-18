// The installed app's icon: the overlap mark on the app's dark background. Drawn for next/og
// (satori), so plain colors, no CSS variables. The mark is 84% wide yet reaches only 0.33 of the size from
// the centre, inside the maskable safe circle (0.4), so one drawing serves "any", "maskable" and Apple.

const BACKGROUND = "#090c11";
const RING_A = "#55d1ca";
const RING_B = "#a9d9d5";
const OVERLAP = "#f1b04f";

export function AppIconArt({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: BACKGROUND }}>
      {/* viewBox 200 × 120: rings r 44, centres 60 apart; they meet at x 100, y 60 ± 32.19. */}
      <svg width={size * 0.84} height={size * 0.504} viewBox="0 0 200 120">
        <circle cx="70" cy="60" r="44" fill="none" stroke={RING_A} strokeWidth="7" />
        <circle cx="130" cy="60" r="44" fill="none" stroke={RING_B} strokeWidth="7" />
        <path d="M100 27.81 A44 44 0 0 1 100 92.19 A44 44 0 0 1 100 27.81 Z" fill={OVERLAP} />
      </svg>
    </div>
  );
}
