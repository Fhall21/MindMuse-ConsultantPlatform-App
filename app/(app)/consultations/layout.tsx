import { ConsultationsSectionShell } from "@/components/consultations/consultations-section-shell";

export default function ConsultationsLayout({ children }: { children: React.ReactNode }) {
  return <ConsultationsSectionShell>{children}</ConsultationsSectionShell>;
}
