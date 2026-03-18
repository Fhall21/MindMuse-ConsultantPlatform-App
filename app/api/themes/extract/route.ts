import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (!aiServiceUrl) {
    return NextResponse.json({ detail: "AI_SERVICE_URL is not configured" }, { status: 503 });
  }

  const body = await request.json();

  let response: Response;
  try {
    response = await fetch(`${aiServiceUrl}/themes/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI service";
    return NextResponse.json({ detail: message }, { status: 502 });
  }

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
