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

/**
 * Some current labels come from openFDA with an empty `openfda` block (no product type, route, brand or
 * NDCs), so a search on those fields never finds them. For such a label found through its NDC products,
 * take those facts from the NDC Directory records. A label with its own block is returned unchanged.
 */
export function withNdcOpenfda(label: FdaLabel, products: NdcProduct[]): FdaLabel {
  if (label.openfda && Object.keys(label.openfda).length > 0) return label;
  const uniq = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))];
  return {
    ...label,
    openfda: {
      product_type: uniq(products.map((p) => p.product_type)),
      route: uniq(products.flatMap((p) => p.route ?? [])),
      brand_name: uniq(products.map((p) => p.brand_name?.trim())),
      generic_name: uniq(products.map((p) => p.generic_name?.trim())),
      manufacturer_name: uniq(products.map((p) => p.labeler_name?.trim())),
      package_ndc: uniq(products.flatMap((p) => (p.packaging ?? []).map((k) => k.package_ndc))),
    },
  };
}
