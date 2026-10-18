// Which record tab a path belongs to, and where the phone's bottom tab bar steps aside. Pure.
// The add flow (photo, match, retake) and the per-field review have their own Cancel and action bars.

export type RecordTab = "medicines" | "report";

const OWN_BAR = /\/(add(\/.*)?|entries\/[^/]+\/(match|retake|review))$/;

export function recordNav(pathname: string): { current: RecordTab; hidden: boolean } {
  return {
    current: /\/export(\/|$)/.test(pathname) ? "report" : "medicines",
    hidden: OWN_BAR.test(pathname),
  };
}
