import { NextResponse } from "next/server";
import {
  accessSharedReport,
  getPublicReportShareMetadata,
} from "@/lib/data/report-shares";
import { unlockReportShareSchema } from "@/lib/validations/report-share";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const share = await getPublicReportShareMetadata(token);

    if (!share) {
      return NextResponse.json({ detail: "Share link not found" }, { status: 404 });
    }

    return NextResponse.json(share);
  } catch (error) {
    console.error("[public-share:metadata] failed:", error);
    return NextResponse.json({ detail: "Failed to load share link" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const parsed = unlockReportShareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: "Validation failed", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const report = await accessSharedReport({
      token,
      passcode: parsed.data.passcode,
      request,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("[public-share:unlock] failed:", error);
    const detail = error instanceof Error ? error.message : "Failed to unlock share link";
    const status = detail === "Incorrect passcode"
      ? 403
      : detail === "This share link is unavailable"
        ? 404
        : 500;
    return NextResponse.json({ detail }, { status });
  }
}