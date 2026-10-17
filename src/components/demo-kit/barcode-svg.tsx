import { barRuns, encodeUpcA, EXTENDED_RANGES } from "./upc-a";

// Geometry in module units. Quiet zones are 11 modules wide (the spec minimum is 9) and also
// carry the first and last human-readable digits, as on a retail UPC-A.
const QUIET = 11;
const BAR_HEIGHT = 64;
const FONT = 10;
const EXTEND = FONT / 2;
const WIDTH = QUIET * 2 + 95;
const HEIGHT = BAR_HEIGHT + FONT + 3;

const isExtended = (x: number) => EXTENDED_RANGES.some(([a, b]) => x >= a && x < b);

/**
 * A scannable UPC-A barcode as crisp black-on-white SVG.
 * Size it with `className` (e.g. `w-[2.6in]`); the aspect ratio is fixed.
 */
export function BarcodeSvg({ upc, className, title }: { upc: string; className?: string; title?: string }) {
  const runs = barRuns(encodeUpcA(upc));
  const digit = (i: number, x: number) => (
    <text key={i} x={x} y={BAR_HEIGHT + FONT + 1} textAnchor="middle" fontSize={FONT} fontFamily="ui-monospace, monospace">
      {upc[i]}
    </text>
  );
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label={title ?? `UPC-A barcode ${upc}`}
      shapeRendering="crispEdges"
      style={{ background: "#fff" }}
    >
      <rect width={WIDTH} height={HEIGHT} fill="#fff" />
      <g fill="#000">
        {runs.map((r) => (
          <rect
            key={r.x}
            x={QUIET + r.x}
            y={0}
            width={r.width}
            height={isExtended(r.x) ? BAR_HEIGHT + EXTEND : BAR_HEIGHT}
          />
        ))}
        {digit(0, QUIET / 2)}
        {[1, 2, 3, 4, 5].map((i) => digit(i, QUIET + 10 + (i - 1) * 7 + 3.5))}
        {[6, 7, 8, 9, 10].map((i) => digit(i, QUIET + 50 + (i - 6) * 7 + 3.5))}
        {digit(11, QUIET + 95 + QUIET / 2)}
      </g>
    </svg>
  );
}
