import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupFormulationByBarcode } from "@/lib/catalog-lookup";

/** GET /api/ndc/<barcode text or NDC> → `{ formulation }`, or 404 when we can't find it. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/ndc/[code]">) {
  // A live openFDA hit writes to the catalog, so only signed-in (incl. anonymous) users may look up.
  if (!(await getCurrentUser())) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { code } = await ctx.params;
  const formulation = await lookupFormulationByBarcode(code);
  if (!formulation) return Response.json({ error: "Not in our supported list" }, { status: 404 });
  return Response.json({ formulation });
}
