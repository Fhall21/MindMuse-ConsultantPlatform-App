import { NextRequest, NextResponse } from "next/server";
import { saveEditedReport } from "@/lib/actions/reports";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let content: string;
  try {
    const body = await req.json();
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    content = body.content;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await saveEditedReport(id, content);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[edit-report] failed:", error);
    return NextResponse.json({ error: "Failed to save edited report" }, { status: 500 });
  }
}
