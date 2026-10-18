import { BottomBar } from "@/components/nav/bottom-bar";
import { isUuid } from "@/lib/uuid";

/** A person's record. On phones the record tabs sit in a bar at the bottom, shared by its pages. */
export default async function RecordLayout({ children, params }: LayoutProps<"/patients/[patientId]">) {
  const { patientId } = await params;
  return (
    <>
      {children}
      {isUuid(patientId) ? <BottomBar patientId={patientId} /> : null}
    </>
  );
}
