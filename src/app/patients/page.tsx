import { redirect } from "next/navigation";
import { homePath } from "@/lib/auth";

/** One person per account: /patients opens the person's own capture page (signed-out visitors go to the start page). */
export default async function PatientsPage() {
  redirect(await homePath());
}
