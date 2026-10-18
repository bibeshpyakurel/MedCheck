// Real FDA records, trimmed to the fields the import reads. Labels come from api.fda.gov/drug/label.json,
// products from the NDC Directory bulk file (api.fda.gov/download.json → drug.ndc), both fetched 2026-10-17.
import labelsJson from "./labels.json";
import productsJson from "./ndc-products.json";
import type { FdaLabel, NdcProduct } from "../types";

const LABELS = labelsJson as unknown as Record<string, FdaLabel>;
const PRODUCTS = productsJson as unknown as Record<string, NdcProduct[]>;

export type FixtureName = keyof typeof labelsJson;

export function fixtureLabel(name: FixtureName): FdaLabel {
  return structuredClone(LABELS[name]);
}

export function fixtureProducts(name: FixtureName): NdcProduct[] {
  return structuredClone(PRODUCTS[name] ?? []);
}

export function allFixtureNames(): FixtureName[] {
  return Object.keys(LABELS) as FixtureName[];
}

export function allFixtureProducts(): NdcProduct[] {
  return Object.values(PRODUCTS).flat().map((p) => structuredClone(p));
}
