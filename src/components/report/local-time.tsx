"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The browser's IANA time zone (null during server render). */
export function useTimeZone(): string | null {
  return useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/** A timestamp in the viewer's own time zone, labelled with the zone ("Oct 17, 2026, 2:05 PM CDT"). */
export function LocalTime({ iso }: { iso: string }) {
  const timeZone = useTimeZone();
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone ?? "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
  return <time dateTime={iso}>{text}</time>;
}
