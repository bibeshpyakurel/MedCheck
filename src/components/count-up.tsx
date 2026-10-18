"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * A count that ticks up from zero the first time it's shown in this tab, then just shows the number.
 * The server renders the real number, so it reads right without JS; the tick lasts 320 ms.
 */
export function CountUp({ value, id }: { value: number; id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

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
    if (!el || seen || reduced || value === 0) return;
    const controls = animate(0, value, {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => (el.textContent = String(Math.round(n))),
    });
    return () => controls.stop();
  }, [id, value, reduced]);

  return <span ref={ref}>{value}</span>;
}
