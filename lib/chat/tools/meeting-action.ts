import { z } from "zod";

export const selectMeetingForActionSchema = z.object({
  consultation_id: z.string().uuid().optional(),
});
