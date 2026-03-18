import { z } from "zod/v4";

export const consultationSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  transcript_raw: z.string().optional(),
  status: z.enum(["draft", "complete"]).default("draft"),
});

export type ConsultationFormData = z.infer<typeof consultationSchema>;

export const themeSchema = z.object({
  label: z.string().min(1, "Theme label is required").max(255),
  accepted: z.boolean().default(false),
});

export type ThemeFormData = z.infer<typeof themeSchema>;

export const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  role: z.string().max(255).optional(),
  email: z.email("Invalid email address").optional(),
});

export type PersonFormData = z.infer<typeof personSchema>;

export const evidenceEmailSchema = z.object({
  body_draft: z.string().min(1, "Email body is required"),
});

export type EvidenceEmailFormData = z.infer<typeof evidenceEmailSchema>;
