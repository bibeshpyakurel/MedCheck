import { cn } from "@/lib/utils";

// A few calm, distinguishable tints. Chosen by name so a person keeps their colour.
const TINTS = [
  "bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-400/15 dark:text-teal-200 dark:ring-teal-300/20",
  "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-300/20",
  "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-300/20",
  "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-300/20",
  "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/20",
  "bg-slate-200 text-slate-800 ring-slate-300 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-300/20",
];

function tintFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Initial-letter avatar for a person. Decorative: the name is always shown beside it. */
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full font-semibold ring-1 select-none",
        tintFor(name),
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
