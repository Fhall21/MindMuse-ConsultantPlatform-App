import { postConsultationGroupClusterDecisionResponse } from "../../../../_handlers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationGroupId: string; clusterId: string }> }
) {
  const { consultationGroupId, clusterId } = await params;
  return postConsultationGroupClusterDecisionResponse(request, consultationGroupId, clusterId);
}