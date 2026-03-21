import { getConsultationGroupAuditEventsResponse } from "../_handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationGroupId: string }> }
) {
  const { consultationGroupId } = await params;
  return getConsultationGroupAuditEventsResponse(consultationGroupId);
}