import { z } from "zod/v4";

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  transcript_raw: z.string().optional(),
  status: z.enum(["draft", "complete"]).default("draft"),
});

export type MeetingFormData = z.infer<typeof meetingSchema>;

export const themeSchema = z.object({
  label: z.string().min(1, "Theme label is required").max(255),
  accepted: z.boolean().default(false),
});

export type ThemeFormData = z.infer<typeof themeSchema>;

export const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  working_group: z.string().max(255).optional(),
  work_type: z.string().max(255).optional(),
  role: z.string().max(255).optional(),
  email: z.email("Invalid email address").optional().or(z.literal("")),
});

export type PersonFormData = z.infer<typeof personSchema>;

export const evidenceEmailSchema = z.object({
  body_draft: z.string().min(1, "Email body is required"),
});

export type EvidenceEmailFormData = z.infer<typeof evidenceEmailSchema>;

export const consultationSchema = z.object({
  label: z.string().min(1, "Label is required").max(255),
  description: z.string().max(500).optional(),
});

export type ConsultationFormData = z.infer<typeof consultationSchema>;

export const phaseSchema = z.object({
  type: z.enum(["discovery", "discussion", "review_feedback"]),
  label: z.string().max(255).optional(),
});

export type PhaseFormData = z.infer<typeof phaseSchema>;

export const uuidArraySchema = (maxLength = 100) =>
  z.array(z.uuid()).max(maxLength, `No more than ${maxLength} IDs allowed`);
