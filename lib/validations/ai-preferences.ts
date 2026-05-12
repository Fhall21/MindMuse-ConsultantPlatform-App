import { z } from "zod/v4";

const trimmedString = z.string().transform((s) => s.trim());

export const aiPreferencesSchema = z.object({
  consultationTypes: z
    .array(trimmedString.pipe(z.string().min(1).max(100)))
    .max(5, "Maximum 5 consultation types allowed")
    .default([]),

  focusAreas: z
    .array(trimmedString.pipe(z.string().min(1).max(200)))
    .max(10, "Maximum 10 focus areas allowed")
    .default([]),

  industry: z
    .string()
    .max(150, "Keep industry / practice area under 150 characters")
    .transform((value) => value.trim())
    .default(""),

  excludedTopics: z
    .array(trimmedString.pipe(z.string().min(1).max(200)))
    .max(10, "Maximum 10 excluded topics allowed")
    .default([]),

  emailGuidance: z
    .string()
    .max(600, "Keep email guidance under 600 characters")
    .transform((value) => value.trim())
    .default(""),

  anonymousMode: z.boolean().default(false),
});

export type AIPreferencesFormData = z.infer<typeof aiPreferencesSchema>;

export const signalRationaleSchema = z.object({
  rationale: z.string().max(500).optional(),
});

export type SignalRationaleFormData = z.infer<typeof signalRationaleSchema>;
