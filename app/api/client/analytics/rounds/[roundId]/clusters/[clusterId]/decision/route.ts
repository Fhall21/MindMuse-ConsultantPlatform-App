import { postConsultationGroupClusterDecisionResponse } from "../../../../../consultation-groups/_handlers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string; clusterId: string }> }
) {
  const { roundId, clusterId } = await params;
  return postConsultationGroupClusterDecisionResponse(request, roundId, clusterId);
}
