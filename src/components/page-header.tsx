import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export { BackLink };

/** Consistent page title block: optional back link, eyebrow, title, description, meta and actions. */
export function PageHeader({
  back,
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  back?: { href: string; label: ReactNode; toPrevious?: boolean };
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {back ? (
        <BackLink href={back.href} toPrevious={back.toPrevious}>
          {back.label}
        </BackLink>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">{description}</p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** A titled group inside a page. */
export function SectionHeading({
  id,
  title,
  description,
  action,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="space-y-1">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
