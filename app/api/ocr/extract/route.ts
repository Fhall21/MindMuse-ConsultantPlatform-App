import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (!aiServiceUrl) {
    return NextResponse.json({ detail: "AI_SERVICE_URL is not configured" }, { status: 503 });
  }

  // Forward multipart FormData as-is — do not set Content-Type manually;
  // fetch will set it with the correct boundary when given a FormData body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Request body must be multipart/form-data" }, { status: 422 });
  }

  let response: Response;
  try {
    response = await fetch(`${aiServiceUrl}/ocr/extract`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI service";
    return NextResponse.json({ detail: message }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return NextResponse.json({ detail: text }, { status: response.ok ? 502 : response.status });
  }

  const data = await response.json();
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  return NextResponse.json(data);
}
