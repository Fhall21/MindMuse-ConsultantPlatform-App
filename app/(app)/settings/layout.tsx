import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage your account, accessibility preferences, and the workspace controls that make the
          platform feel more polished day to day.
        </p>
      </div>

      <SettingsNav />

      <div className="min-w-0 space-y-6">
        {children}
      </div>
    </div>
  );
}
