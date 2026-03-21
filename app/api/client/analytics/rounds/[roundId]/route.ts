import { getConsultationGroupAnalyticsResponse } from "../../consultation-groups/_handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  return getConsultationGroupAnalyticsResponse(roundId);
}
