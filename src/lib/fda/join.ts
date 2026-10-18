// Join an FDA label to its NDC Directory products. Pure.
// Primary key: the label's `id` (its SPL version id) equals the products' `spl_id` — verified on the full
// 2026-10-16 data: every oral OTC label joins this way. Fallback: products sharing a package NDC.
import type { FdaLabel, NdcProduct } from "./types";

export type NdcIndex = {
  bySplId: Map<string, NdcProduct[]>;
  byPackage: Map<string, NdcProduct[]>;
};

export type JoinMethod = "spl_id" | "package_ndc" | "none";

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function indexNdcProducts(products: NdcProduct[]): NdcIndex {
  const index: NdcIndex = { bySplId: new Map(), byPackage: new Map() };
  for (const p of products) {
    if (p.spl_id) push(index.bySplId, p.spl_id, p);
    for (const pkg of p.packaging ?? []) if (pkg.package_ndc) push(index.byPackage, pkg.package_ndc, p);
  }
  return index;
}

export function joinLabel(label: FdaLabel, index: NdcIndex): { method: JoinMethod; products: NdcProduct[] } {
  const bySpl = label.id ? index.bySplId.get(label.id) : undefined;
  if (bySpl?.length) return { method: "spl_id", products: [...bySpl] };

  const found = new Set<NdcProduct>();
  for (const ndc of label.openfda?.package_ndc ?? []) for (const p of index.byPackage.get(ndc) ?? []) found.add(p);
  if (found.size > 0) return { method: "package_ndc", products: [...found] };
  return { method: "none", products: [] };
}
