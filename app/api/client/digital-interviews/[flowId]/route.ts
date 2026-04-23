import { NextRequest, NextResponse } from "next/server";
import {
  closeDigitalInterviewFlow,
  digitalInterviewFlowUpdateSchema,
  getDigitalInterviewFlowDetailForUser,
  updateDigitalInterviewFlowStatus,
} from "@/lib/data/digital-interviews";
import { jsonError, requireRouteClient } from "../../_helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const { flowId } = await params;
    const flow = await getDigitalInterviewFlowDetailForUser(flowId, client.userId);

    if (!flow) {
      return jsonError("Digital interview not found", 404);
    }

    return NextResponse.json({ data: flow });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load digital interview");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const { flowId } = await params;
    const body = await request.json();
    const parsed = digitalInterviewFlowUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid digital interview payload", 422);
    }

    const flow = await updateDigitalInterviewFlowStatus(flowId, client.userId, parsed.data.status);

    if (!flow) {
      return jsonError("Digital interview not found", 404);
    }

    return NextResponse.json({ data: flow });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update digital interview");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) {
    return client.response;
  }

  try {
    const { flowId } = await params;
    const flow = await closeDigitalInterviewFlow(flowId, client.userId);

    if (!flow) {
      return jsonError("Digital interview not found", 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete digital interview");
  }
}
