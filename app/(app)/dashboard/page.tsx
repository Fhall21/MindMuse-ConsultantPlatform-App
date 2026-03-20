export default function DashboardPage() {
  const metrics = [
    {
      label: "Consultations",
      description: "Recorded consultations",
      value: "0",
    },
    {
      label: "People",
      description: "Linked people",
      value: "0",
    },
    {
      label: "Evidence Emails",
      description: "Drafted or sent",
      value: "0",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Current workspace totals.
        </p>
      </div>

      <dl className="grid gap-4 border-t pt-4 sm:grid-cols-3 sm:gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-2 sm:border-l sm:pl-6 first:sm:border-l-0 first:sm:pl-0">
            <dt className="text-sm font-medium text-foreground">{metric.label}</dt>
            <dd className="text-sm text-muted-foreground">{metric.description}</dd>
            <dd className="text-4xl font-semibold tracking-tight">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
