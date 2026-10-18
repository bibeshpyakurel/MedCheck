"use client";

import { useEffect, useRef } from "react";

const DURATION = 320;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A count that ticks up from zero the first time it's shown in this tab, then just shows the number.
 * The server renders the real number, so it reads right without JS; the tick lasts 320 ms and is
 * skipped under reduced motion. Plain requestAnimationFrame: no animation library on the home page.
 */
export function CountUp({ value, id }: { value: number; id: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const key = `medcheck:counted:${id}`;
    let seen = true;
    try {
      seen = sessionStorage.getItem(key) === String(value);
      sessionStorage.setItem(key, String(value));
    } catch {
      // Storage blocked: no animation.
    }
    if (!el || seen || value === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / DURATION);
      el.textContent = String(Math.round(easeOut(t) * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = String(value);
    };
  }, [id, value]);

  return <span ref={ref}>{value}</span>;
}
