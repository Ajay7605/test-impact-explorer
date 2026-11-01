import { analyze, AnalyzeError, validateRequest } from "@/lib/impact/analyze";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return Response.json(analyze(validateRequest(body)));
  } catch (error) {
    if (error instanceof AnalyzeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("analyze failed", error);
    return Response.json({ error: "Something went wrong while analysing the project." }, { status: 500 });
  }
}
