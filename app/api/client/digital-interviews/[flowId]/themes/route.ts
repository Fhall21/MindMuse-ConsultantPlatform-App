import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireRouteClient } from "../../../_helpers";
import {
  listDigitalInterviewThemes,
  saveDigitalInterviewThemes,
  acceptDigitalInterviewTheme,
  rejectDigitalInterviewTheme,
} from "@/lib/data/digital-interview-themes";

const saveSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string().min(1),
      description: z.string().nullable().optional(),
    })
  ),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), themeId: z.string().uuid() }),
  z.object({ action: z.literal("reject"), themeId: z.string().uuid() }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { flowId } = await params;
    const themes = await listDigitalInterviewThemes(flowId, client.userId);
    return NextResponse.json({ data: themes });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load themes");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { flowId } = await params;
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    const themes = await saveDigitalInterviewThemes(flowId, client.userId, parsed.data.themes);
    return NextResponse.json({ data: themes });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save themes");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const client = await requireRouteClient();
  if ("response" in client) return client.response;

  try {
    const { flowId } = await params;
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
    }

    if (parsed.data.action === "accept") {
      await acceptDigitalInterviewTheme(parsed.data.themeId, flowId, client.userId);
    } else {
      await rejectDigitalInterviewTheme(parsed.data.themeId, flowId, client.userId);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update theme");
  }
}
