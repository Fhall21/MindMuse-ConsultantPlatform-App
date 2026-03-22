import { redirect } from "next/navigation";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/consultations/rounds/${id}`);
}
