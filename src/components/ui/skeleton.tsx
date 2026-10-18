import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // A soft shimmer across --muted; still under reduced motion.
        "relative overflow-hidden rounded-md bg-muted before:absolute before:inset-0 before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-foreground/6 before:to-transparent",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
