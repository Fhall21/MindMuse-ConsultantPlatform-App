import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearRoundFailedJobs,
  getRoundAnalyticsDataSet,
  getRoundAnalyticsJobStatuses,
  recordAnalyticsClusterDecision,
  triggerRoundAnalyticsJobs,
} from "@/lib/actions/analytics";
import { analyticsRouteError } from "../_helpers";
import { requireRouteClient } from "../../_helpers";

const decisionSchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  rationale: z.string().optional(),
  editedLabel: z.string().optional(),
});

export async function getConsultationGroupAnalyticsResponse(consultationGroupId: string) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await getRoundAnalyticsDataSet(consultationGroupId);
    return NextResponse.json({ data });
  } catch (error) {
    return analyticsRouteError(error, "Failed to load consultation group analytics");
  }
}

export async function getConsultationGroupAnalyticsJobsResponse(consultationGroupId: string) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await getRoundAnalyticsJobStatuses(consultationGroupId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics/consultation-groups/jobs GET] error", {
      consultationGroupId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return analyticsRouteError(error, "Failed to load consultation group analytics job statuses");
  }
}

export async function postConsultationGroupAnalyticsJobsResponse(consultationGroupId: string) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await triggerRoundAnalyticsJobs(consultationGroupId);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return analyticsRouteError(error, "Failed to trigger consultation group analytics jobs");
  }
}

export async function deleteConsultationGroupFailedJobsResponse(consultationGroupId: string) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const data = await clearRoundFailedJobs(consultationGroupId);
    return NextResponse.json(data);
  } catch (error) {
    return analyticsRouteError(error, "Failed to clear failed analytics jobs");
  }
}

export async function postConsultationGroupClusterDecisionResponse(
  request: Request,
  consultationGroupId: string,
  clusterId: string
) {
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
      roundId: consultationGroupId,
      clusterId: numericClusterId,
      action: parsed.data.action,
      rationale: parsed.data.rationale,
      editedLabel: parsed.data.editedLabel,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return analyticsRouteError(error, "Failed to record consultation group analytics cluster decision");
  }
}