import {
  getConsultationGroupAnalyticsJobsResponse,
  postConsultationGroupAnalyticsJobsResponse,
} from "../../_handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationGroupId: string }> }
) {
  const { consultationGroupId } = await params;
  return getConsultationGroupAnalyticsJobsResponse(consultationGroupId);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ consultationGroupId: string }> }
) {
  const { consultationGroupId } = await params;
  return postConsultationGroupAnalyticsJobsResponse(consultationGroupId);
}