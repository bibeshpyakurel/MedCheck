import Link from "next/link";

/** The MedCheck wordmark, linking home. Shared by the app shell and the error pages. */
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        M
      </span>
      MedCheck
    </Link>
  );
}
