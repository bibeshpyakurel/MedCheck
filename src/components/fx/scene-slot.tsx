"use client";

import { Component, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFxBudget } from "@/components/fx/fx-budget";
import { canRunHeavyFx, fxContext } from "@/lib/fx";
import { cn } from "@/lib/utils";

export type SceneApi = {
  /** The live scene calls this once it has drawn its first frame; the poster then fades out. */
  onReady: () => void;
  /** False while the slot is offscreen or the tab is hidden: the scene pauses. */
  active: boolean;
};

/**
 * The one wrapper for every 3D or shader scene (Spline, Unicorn Studio). The poster renders at once in
 * a fixed aspect-ratio box, so nothing shifts. The live scene (`children`, loaded with next/dynamic,
 * ssr: false) mounts only when effects are allowed (src/lib/fx.ts), the slot is near the viewport,
 * the browser is idle and the FX budget grants a lease. A scene that throws falls back to the poster.
 * With no `children` the slot is just its poster: the CSS stand-ins until the real scenes exist.
 */
export function SceneSlot({
  poster,
  aspect,
  ariaLabel,
  priority = 0,
  className,
  style,
  children,
}: {
  poster: ReactNode;
  /** CSS aspect-ratio, e.g. "1 / 1". Omit when the parent sizes the slot. */
  aspect?: string;
  /** What the scene shows, for screen readers; omit for pure decoration. */
  ariaLabel?: string;
  priority?: number;
  className?: string;
  style?: CSSProperties;
  children?: (api: SceneApi) => ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const budget = useFxBudget();
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [idle, setIdle] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const wantsScene = !!children;

  useEffect(() => {
    if (!wantsScene) return;
    const el = ref.current;
    if (!el) return;
    const nearObserver = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "200px" });
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    nearObserver.observe(el);
    onScreen.observe(el);
    const done = () => {
      setAllowed(canRunHeavyFx(fxContext()));
      setIdle(true);
    };
    // Safari has no requestIdleCallback.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle ? window.requestIdleCallback(done, { timeout: 1500 }) : setTimeout(done, 1500);
    return () => {
      nearObserver.disconnect();
      onScreen.disconnect();
      if (hasIdle) window.cancelIdleCallback(handle as number);
      else clearTimeout(handle);
    };
  }, [wantsScene]);

  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const eligible = wantsScene && allowed && near && idle && !failed;
  const request = budget?.request;
  const release = budget?.release;
  useEffect(() => {
    if (!eligible || !request || !release) return;
    request({ id, priority });
    return () => release(id);
  }, [eligible, id, priority, request, release]);

  const live = eligible && (budget ? budget.granted.has(id) : true);
  const showPoster = !live || !ready;

  return (
    <div
      ref={ref}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("relative overflow-hidden", className)}
      style={{ aspectRatio: aspect, ...style }}
    >
      <div aria-hidden className={cn("absolute inset-0 transition-opacity duration-400", showPoster ? "opacity-100" : "opacity-0")}>
        {poster}
      </div>
      {live && children ? (
        <div aria-hidden className={cn("absolute inset-0 transition-opacity duration-400", ready ? "opacity-100" : "opacity-0")}>
          <SceneBoundary onError={() => setFailed(true)}>
            {children({ onReady: () => setReady(true), active: visible && tabVisible })}
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}

/** A scene that throws leaves the poster in place, silently. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Scene failed; showing its poster", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
