import { NextResponse } from "next/server";
import { revokeReportShareLink } from "@/lib/data/report-shares";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params;

  try {
    const link = await revokeReportShareLink(id, shareId);
    return NextResponse.json(link);
  } catch (error) {
    console.error("[report-share:revoke] failed:", error);
    const detail = error instanceof Error ? error.message : "Failed to revoke share link";
    const status = detail.includes("not found") ? 404 : 500;
    return NextResponse.json({ detail }, { status });
  }
}