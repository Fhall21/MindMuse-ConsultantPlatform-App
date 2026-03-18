import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

if (!AI_SERVICE_URL) {
  throw new Error("AI_SERVICE_URL environment variable is not set");
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(`${AI_SERVICE_URL}/themes/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
