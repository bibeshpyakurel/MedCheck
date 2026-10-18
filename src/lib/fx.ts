// The effects kill switch and capability gate. Pure; the browser reads its inputs in fxContext().
// Effects are decoration: off with reduced motion, Save-Data, a weak device, the build switch
// (NEXT_PUBLIC_FX=0) or, live during a demo, ?fx=0 (remembered for the tab's session).

export type FxOverride = "on" | "off" | null;

export type FxContext = {
  buildEnabled: boolean;
  override: FxOverride;
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory: number | undefined;
  cores: number | undefined;
};

export const FX_BUILD_ENABLED = process.env.NEXT_PUBLIC_FX !== "0";

const STORAGE_KEY = "medcheck:fx";

/** `?fx=0` → "off", `?fx=1` → "on", else null. */
export function fxOverride(search: string): FxOverride {
  const fx = new URLSearchParams(search).get("fx");
  return fx === "0" ? "off" : fx === "1" ? "on" : null;
}

/** Reduced motion always wins; then the build switch and ?fx=; then the device. */
export function canRunHeavyFx(c: FxContext): boolean {
  if (c.reducedMotion || !c.buildEnabled || c.override === "off") return false;
  if (c.override === "on") return true;
  if (c.saveData) return false;
  return (c.deviceMemory ?? 8) >= 4 && (c.cores ?? 8) >= 4;
}

/** The browser's answers. Call only on the client. */
export function fxContext(): FxContext {
  let override = fxOverride(window.location.search);
  try {
    if (override) sessionStorage.setItem(STORAGE_KEY, override);
    else override = (sessionStorage.getItem(STORAGE_KEY) as FxOverride) ?? null;
  } catch {
    // Storage blocked (private mode): the URL still works for this page.
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    buildEnabled: FX_BUILD_ENABLED,
    override,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData === true,
    deviceMemory: nav.deviceMemory,
    cores: navigator.hardwareConcurrency,
  };
}
