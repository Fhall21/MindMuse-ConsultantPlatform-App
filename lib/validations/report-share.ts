import { z } from "zod/v4";

const trimmedString = z.string().transform((value) => value.trim());

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const reportShareSettingsSchema = z.object({
  passcode: trimmedString.pipe(
    z
      .string()
      .min(8, "Use at least 8 characters for the share passcode")
      .max(64, "Use at most 64 characters for the share passcode")
  ),
});

export const createReportShareLinkSchema = z.object({
  consultantName: optionalTrimmedString,
  consultantEmail: trimmedString.pipe(
    z.string().email("Enter a valid consultant email address").max(320)
  ),
  expiresInDays: z
    .coerce
    .number()
    .int()
    .min(1, "Expiry must be at least 1 day")
    .max(30, "Expiry cannot exceed 30 days"),
});

export const unlockReportShareSchema = z.object({
  passcode: trimmedString.pipe(
    z.string().min(1, "Enter the share passcode")
  ),
});

export type ReportShareSettingsFormData = z.infer<typeof reportShareSettingsSchema>;
export type CreateReportShareLinkFormData = z.infer<
  typeof createReportShareLinkSchema
>;
export type UnlockReportShareFormData = z.infer<typeof unlockReportShareSchema>;