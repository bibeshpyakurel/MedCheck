import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchFormulations } from "@/lib/catalog";
import { toMatchOption, type MatchOption } from "@/lib/photo-flow";

const MAX_QUERY = 100;
const MAX_RESULTS = 8;

/**
 * `GET ?q=<name>` → `{ options }`: catalog labels whose brand or generic name resembles `q`, best
 * first, as the "Type it in" picker shows them. Signed-in users only.
 */
export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (q.length < 2) return NextResponse.json({ options: [] satisfies MatchOption[] });
  try {
    const results = await searchFormulations(q, MAX_RESULTS);
    return NextResponse.json({ options: results.map((f) => toMatchOption(f)) });
  } catch (error) {
    console.error("Catalog search failed", error);
    return NextResponse.json({ error: "Search isn't working right now." }, { status: 502 });
  }
}
