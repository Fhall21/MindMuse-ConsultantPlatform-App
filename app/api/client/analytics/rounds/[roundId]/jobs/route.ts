import {
  getConsultationGroupAnalyticsJobsResponse,
  postConsultationGroupAnalyticsJobsResponse,
} from "../../../consultation-groups/_handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  return getConsultationGroupAnalyticsJobsResponse(roundId);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  return postConsultationGroupAnalyticsJobsResponse(roundId);
}
