import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupFormulationByBarcode } from "@/lib/catalog-lookup";

/**
 * GET /api/ndc/<barcode text or NDC> → `{ formulation }`, 404 when no label matches, or 503 when
 * it isn't in the catalog and openFDA didn't answer.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/ndc/[code]">) {
  // A live openFDA hit writes to the catalog, so only signed-in (incl. anonymous) users may look up.
  if (!(await getCurrentUser())) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { code } = await ctx.params;
  const formulation = await lookupFormulationByBarcode(code);
  if (formulation === "unavailable") {
    return Response.json({ error: "The FDA label database didn't answer" }, { status: 503 });
  }
  if (!formulation) return Response.json({ error: "Not in our supported list" }, { status: 404 });
  return Response.json({ formulation });
}
