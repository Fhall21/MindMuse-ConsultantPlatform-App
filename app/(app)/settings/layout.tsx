import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <SettingsNav />

      <div className="mx-auto w-full max-w-5xl min-w-0">{children}</div>
    </div>
  );
}
