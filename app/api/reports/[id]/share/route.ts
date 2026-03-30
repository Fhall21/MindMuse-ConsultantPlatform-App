import { NextRequest, NextResponse } from "next/server";
import {
  createReportShareLink,
  listReportShareLinksForArtifact,
} from "@/lib/data/report-shares";
import { createReportShareLinkSchema } from "@/lib/validations/report-share";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const links = await listReportShareLinksForArtifact(id);
    return NextResponse.json(links);
  } catch (error) {
    console.error("[report-share:list] failed:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Failed to load share links" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = createReportShareLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: "Validation failed", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const link = await createReportShareLink({
      artifactId: id,
      consultantName: parsed.data.consultantName,
      consultantEmail: parsed.data.consultantEmail,
      expiresInDays: parsed.data.expiresInDays,
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("[report-share:create] failed:", error);
    const detail = error instanceof Error ? error.message : "Failed to create share link";
    const status = detail.includes("passcode") ? 400 : 500;
    return NextResponse.json({ detail }, { status });
  }
}