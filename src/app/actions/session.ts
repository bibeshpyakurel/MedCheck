"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { listFormulations } from "@/lib/catalog";
import { buildDemoHousehold, DEMO_CAREGIVER_NAME, hasOwnRecords } from "@/lib/demo/household";
import {
  confirmEntry,
  createDraftEntry,
  createPatient,
  createSourceDocument,
  deletePatient,
  getCaregiver,
  listPatients,
  upsertCaregiver,
} from "@/lib/records";
import { isSelf } from "@/lib/record-format";
import { createClient } from "@/lib/supabase/server";

/** Signs in anonymously when there is no session. The session cookie is set on this response. */
async function ensureSession(): Promise<void> {
  if (await getCurrentUser()) return;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Could not start a session: ${error.message}`);
}

/** Creates the demo household for the current user and returns the first demo profile's id. */
async function createDemoHousehold(): Promise<string> {
  const caregiver = (await getCaregiver()) ?? (await upsertCaregiver());
  // Someone who already set themselves up keeps their own name and "Me" profile; the demo then
  // adds only Sam. Otherwise the user becomes Alex, with "Me (Alex)" as well.
  const ownName = caregiver.displayName && caregiver.displayName !== DEMO_CAREGIVER_NAME;
  const ownSelf = (await listPatients()).some((p) => isSelf(p) && !p.isDemo);
  const household = buildDemoHousehold(await listFormulations(), { includeSelf: !ownName && !ownSelf });
  if (!caregiver.displayName) await upsertCaregiver(household.caregiverName);

  let firstPatientId: string | null = null;
  for (const p of household.patients) {
    const patient = await createPatient({
      displayName: p.displayName,
      relationship: p.relationship,
      notes: p.notes,
      isDemo: true,
    });
    firstPatientId ??= patient.id;
    for (const e of p.entries) {
      const doc = await createSourceDocument({ patientId: patient.id, kind: e.documentKind });
      const draft = await createDraftEntry({
        patientId: patient.id,
        sourceDocumentId: doc.id,
        formulationId: e.formulationId,
        inputMethod: e.inputMethod,
        fields: e.fields,
      });
      await confirmEntry(draft.id, e.fields);
    }
  }
  if (!firstPatientId) throw new Error("Demo household has no patients");
  return firstPatientId;
}

/** "Try the demo household": session → Alex's household (Me + Sam) → the first demo record. Reuses an existing one. */
export async function startDemo(): Promise<void> {
  await ensureSession();
  const existing = (await listPatients()).find((p) => p.isDemo);
  const patientId = existing?.id ?? (await createDemoHousehold());
  revalidatePath("/", "layout");
  redirect(`/patients/${patientId}`);
}

/** "Start my own": session → caregiver name. */
export async function startOwn(): Promise<void> {
  await ensureSession();
  const caregiver = (await getCaregiver()) ?? (await upsertCaregiver());
  revalidatePath("/", "layout");
  redirect(caregiver.displayName ? "/patients" : "/welcome");
}

/** Deletes every demo patient (their documents, entries and history cascade) and recreates the household. */
export async function resetDemo(): Promise<void> {
  await requireUser();
  for (const p of await listPatients()) {
    if (p.isDemo) await deletePatient(p.id);
  }
  const patientId = await createDemoHousehold();
  revalidatePath("/", "layout");
  redirect(`/patients/${patientId}`);
}

/**
 * "Exit demo": deletes the demo profiles (never the user's own). Someone with their own records stays
 * signed in and goes back to them; a demo-only session is signed out and lands on the start page,
 * where "Start my own" begins fresh.
 */
export async function exitDemo(): Promise<void> {
  await requireUser();
  const [caregiver, patients] = await Promise.all([getCaregiver(), listPatients()]);
  const keepSession = hasOwnRecords(caregiver?.displayName ?? null, patients);
  for (const p of patients) {
    if (p.isDemo) await deletePatient(p.id);
  }
  if (!keepSession) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect(keepSession ? "/patients" : "/");
}

/**
 * Saves the user's name (shown on the pharmacist report) and who they check medicines for.
 * "self" or "both" creates a profile for the user themselves (relationship "self") if there isn't one.
 */
export async function saveCaregiverName(formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("displayName") ?? "").trim().slice(0, 120);
  if (!name) redirect("/welcome?error=name");
  const checkingFor = String(formData.get("checkingFor") ?? "");
  await upsertCaregiver(name);

  const patients = await listPatients();
  let destination = patients.length === 0 ? "/patients/new" : "/patients";
  if (checkingFor === "self" || checkingFor === "both") {
    const me = patients.find(isSelf) ?? (await createPatient({ displayName: name, relationship: "self" }));
    destination = checkingFor === "self" ? `/patients/${me.id}` : "/patients/new";
  } else if (checkingFor === "others") {
    destination = "/patients/new";
  }
  revalidatePath("/", "layout");
  redirect(destination);
}
