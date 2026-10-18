// Shapes of the two FDA sources the OTC import joins. Only the fields we read are typed; everything
// arrives as untrusted JSON, so every field is optional.
import type { OpenFdaLabel } from "@/lib/openfda";

/** An openFDA `drug/label` result. `id` is the SPL version id — the NDC Directory's `spl_id`. */
export type FdaLabel = OpenFdaLabel & { id?: string };

/** An NDC Directory product (`drug/ndc`). */
export type NdcProduct = {
  product_ndc?: string; // "0573-0150"
  spl_id?: string;
  product_type?: string; // "HUMAN OTC DRUG"
  brand_name?: string;
  generic_name?: string;
  labeler_name?: string;
  dosage_form?: string; // "TABLET, FILM COATED"
  route?: string[];
  finished?: boolean;
  active_ingredients?: { name?: string; strength?: string }[]; // strength: "200 mg/1", "100 mg/5mL"
  packaging?: { package_ndc?: string }[]; // "0573-0150-20"
};

/** Routes in scope for this import (spec §1). */
export const IMPORT_ROUTES = ["ORAL", "SUBLINGUAL", "BUCCAL"] as const;
