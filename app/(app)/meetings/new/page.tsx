"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMeeting } from "@/lib/actions/consultations";
import { useConsultations } from "@/hooks/use-consultations";

const newMeetingSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  consultationId: z.string().optional(),
});

type NewMeetingFormData = z.infer<typeof newMeetingSchema>;

export default function NewMeetingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { data: consultations } = useConsultations();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewMeetingFormData>({
    resolver: zodResolver(newMeetingSchema),
    defaultValues: { title: "", consultationId: "" },
  });

  async function onSubmit(data: NewMeetingFormData) {
    setSubmitting(true);
    try {
      const id = await createMeeting({
        title: data.title,
        consultationId: data.consultationId || undefined,
      });
      router.push(`/meetings/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create meeting. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Meeting</h1>
        <p className="text-sm text-muted-foreground">
          Create the record first. Add material after.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Session with Alex — March 2026"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="consultationId">Consultation (optional)</Label>
          <select
            id="consultationId"
            {...register("consultationId")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No consultation</option>
            {consultations?.map((consultation) => (
              <option key={consultation.id} value={consultation.id}>
                {consultation.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create meeting"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/meetings")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
