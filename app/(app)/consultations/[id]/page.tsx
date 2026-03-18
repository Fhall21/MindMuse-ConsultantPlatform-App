export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Consultation {id}
      </h1>
      <p className="text-muted-foreground">
        Consultation detail view — transcript, themes, people, and evidence emails will appear here.
      </p>
    </div>
  );
}
