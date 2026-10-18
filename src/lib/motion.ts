// Motion tokens. UI feedback ≤ 200 ms, screen changes ~320 ms; only the landing hero and the overlap
// diagram run longer. Reduced motion turns all of it off (MotionConfig in OverlapVenn, and the global
// prefers-reduced-motion rule in globals.css for CSS animations).

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

export const dur = { xs: 0.12, sm: 0.2, md: 0.32, lg: 0.6, hero: 1.2 };

export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38 },
  soft: { type: "spring", stiffness: 260, damping: 30 },
  drop: { type: "spring", stiffness: 380, damping: 22 },
} as const;

export const stagger = 0.04;
