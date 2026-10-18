import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// /api/vitallens/* — the VitalLens API behind MedCheck's own origin, for the vitals scan. The browser
// library calls GET resolve-model, then POSTs downsampled face frames to stream; this adds the key
// (VITALLENS_API_KEY, server-only) so it never reaches the browser. Signed-in users only. Nothing
// is stored: frames pass straight through, and the reading is saved later by its own action.
const UPSTREAM = "https://api.rouast.com/vitallens-v3";
const FORWARDED_HEADERS = ["content-type", "x-encoding", "x-state", "x-model", "x-origin"];

type Ctx = RouteContext<"/api/vitallens/[...path]">;

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx, "GET", ["resolve-model"]);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, ctx, "POST", ["stream", "file"]);
}

async function forward(request: NextRequest, ctx: Ctx, method: "GET" | "POST", allowed: string[]) {
  const { path } = await ctx.params;
  const endpoint = path.join("/");
  if (!allowed.includes(endpoint)) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await getCurrentUser())) return Response.json({ error: "Sign in to check vitals." }, { status: 401 });

  const apiKey = process.env.VITALLENS_API_KEY;
  if (!apiKey) return Response.json({ error: "Vitals aren't set up on this site yet." }, { status: 503 });

  const headers = new Headers({ "x-api-key": apiKey });
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/${endpoint}${request.nextUrl.search}`, {
      method,
      headers,
      body: method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
  } catch (error) {
    console.error("VitalLens request failed", error);
    return Response.json({ error: "Couldn't reach VitalLens." }, { status: 502 });
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
