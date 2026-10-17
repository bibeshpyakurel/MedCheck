// STUB (M0). Feature C replaces this with the six real checks; the signature is fixed.
import { CHECK_IDS, type CheckInput, type CheckRun } from "@/lib/domain/schema";

export function runChecks(input: CheckInput): CheckRun[] {
  void input;
  return CHECK_IDS.map((check) => ({
    check,
    status: "not_applicable",
    summary: "Not implemented yet",
    reasons: [],
    findings: [],
  }));
}
