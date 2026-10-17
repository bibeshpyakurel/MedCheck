import type { ComponentProps, ReactNode } from "react";
import { resetDemo } from "@/app/actions/session";
import { ConfirmAction } from "@/components/records/confirm-action";

/** "Reset demo": says what will be replaced and asks before putting the demo household back. */
export function ResetDemoButton({
  children,
  variant,
  className,
}: {
  children: ReactNode;
  variant?: ComponentProps<typeof ConfirmAction>["variant"];
  className?: string;
}) {
  return (
    <ConfirmAction
      action={resetDemo}
      variant={variant}
      className={className}
      title="Reset the demo household?"
      description="This replaces the demo household's medicines, documents and history with the original demo records. Changes you made to the demo will be lost. Your own records aren't affected."
      confirmLabel="Reset demo"
      pendingLabel="Resetting…"
    >
      {children}
    </ConfirmAction>
  );
}
