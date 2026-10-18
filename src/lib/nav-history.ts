// Which MedCheck page came before this one, so a back link can go back in history (keeping that
// page's scroll position) instead of opening it fresh. Client-side module state: a full page load
// starts over, and the back link then works as a plain link. Pure apart from that state.

let current: string | null = null;
let previous: string | null = null;

/** Called on every client-side URL change (see NavigationTracker). */
export function recordVisit(url: string): void {
  if (url === current) return;
  previous = current;
  current = url;
}

/** The MedCheck page visited before the current one, or null. */
export function previousUrl(): string | null {
  return previous;
}

/** For tests. */
export function resetVisits(): void {
  current = null;
  previous = null;
}

function normalize(url: string): string {
  const u = new URL(url, "http://medcheck.local");
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  return `${path}${u.search}`;
}

/** Whether going back in history (to `previous`) lands on `href`. Hashes and trailing slashes don't count. */
export function isBackTo(previous: string | null, href: string): boolean {
  return previous !== null && normalize(previous) === normalize(href);
}
