import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsClusterDecision } from "@/lib/actions/analytics";
import { analyticsRouteError } from "../../../../../_helpers";
import { requireRouteClient } from "../../../../../../_helpers";

const decisionSchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  rationale: z.string().optional(),
  editedLabel: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string; clusterId: string }> }
) {
  const { roundId, clusterId } = await params;
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
    }

    const parsed = decisionSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues[0]?.message ?? "Invalid analytics cluster decision" },
        { status: 422 }
      );
    }

    const numericClusterId = Number(clusterId);
    if (!Number.isInteger(numericClusterId)) {
      return NextResponse.json({ detail: "Cluster id must be an integer" }, { status: 422 });
    }

    const data = await recordAnalyticsClusterDecision({
      roundId,
      clusterId: numericClusterId,
      action: parsed.data.action,
      rationale: parsed.data.rationale,
      editedLabel: parsed.data.editedLabel,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return analyticsRouteError(error, "Failed to record analytics cluster decision");
  }
}
