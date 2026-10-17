// UPC-A bar pattern encoder for the printable demo kit. Pure; no dependencies.
import { upcCheckDigit } from "@/data/fictional-formulations";

// Left-hand (odd parity) codes; right-hand codes are their bitwise complement.
const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R_CODES = L_CODES.map((c) => c.replace(/[01]/g, (b) => (b === "1" ? "0" : "1")));

/** 95 modules ("1" = bar, "0" = space) for a 12-digit UPC-A, check digit verified. */
export function encodeUpcA(upc: string): string {
  if (!/^\d{12}$/.test(upc)) throw new Error(`UPC-A needs 12 digits, got "${upc}"`);
  const expected = upcCheckDigit(upc.slice(0, 11));
  if (Number(upc[11]) !== expected) throw new Error(`Bad UPC-A check digit in ${upc} (expected ${expected})`);
  const d = upc.split("").map(Number);
  return "101" + d.slice(0, 6).map((n) => L_CODES[n]).join("") + "01010" + d.slice(6).map((n) => R_CODES[n]).join("") + "101";
}

/** Contiguous dark modules as `{ x, width }` in module units, for drawing one rect per bar. */
export function barRuns(modules: string): { x: number; width: number }[] {
  const runs: { x: number; width: number }[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    const start = i;
    while (modules[i + 1] === "1") i++;
    runs.push({ x: start, width: i - start + 1 });
  }
  return runs;
}

/** Module ranges printed taller than the data bars: the guards plus the first and last digit (UPC-A convention). */
export const EXTENDED_RANGES: [number, number][] = [
  [0, 10],
  [45, 50],
  [85, 95],
];
