import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { MeetingTypesPanel } from "@/components/settings/meeting-types/meeting-types-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Behaviour</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPreferences />
        </CardContent>
      </Card>
      <MeetingTypesPanel />
    </div>
  );
}
