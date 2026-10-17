import { CircleCheckIcon, FilePlusIcon, HistoryIcon, PencilIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { describeHistory, relativeTime, type HistoryEvent } from "@/lib/history-format";

function iconFor(e: HistoryEvent, title: string) {
  if (e.action === "delete") return Trash2Icon;
  if (title.startsWith("Medicine confirmed")) return CircleCheckIcon;
  if (e.entity === "patients") return UserRoundIcon;
  if (e.entity === "source_documents") return e.action === "insert" ? FilePlusIcon : PencilIcon;
  return e.action === "insert" ? PlusIcon : PencilIcon;
}

const absolute = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Change history for one person, newest first, as readable sentences. */
export function HistoryList({ items, now = new Date() }: { items: HistoryEvent[]; now?: Date }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <HistoryIcon aria-hidden className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No changes yet.</p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-1 rounded-xl border bg-card p-2">
      {items.map((item) => {
        const { title, detail } = describeHistory(item);
        const Icon = iconFor(item, title);
        return (
          <li key={item.id} className="flex gap-3 rounded-lg px-2 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-pretty">{title}</p>
              {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
              <time
                dateTime={item.at}
                title={`${absolute.format(new Date(item.at))} UTC`}
                className="text-xs text-muted-foreground"
              >
                {relativeTime(item.at, now)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
