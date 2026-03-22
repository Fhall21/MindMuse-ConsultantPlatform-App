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
import { createRound } from "@/lib/actions/rounds";

const newConsultationSchema = z.object({
  label: z.string().min(1, "Consultation title is required").max(255),
  description: z.string().max(2000).optional(),
});

type NewConsultationFormData = z.infer<typeof newConsultationSchema>;

export default function NewConsultationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewConsultationFormData>({
    resolver: zodResolver(newConsultationSchema),
    defaultValues: { label: "", description: "" },
  });

  async function onSubmit(data: NewConsultationFormData) {
    setSubmitting(true);
    try {
      const id = await createRound({
        label: data.label,
        description: data.description?.trim() || undefined,
      });
      router.push(`/consultations/rounds/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create consultation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Consultation</h1>
        <p className="text-sm text-muted-foreground">
          Create the consultation record first. Link meetings after.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="label">Consultation title</Label>
          <Input
            id="label"
            placeholder="e.g. R2 Wellbeing Follow-up"
            {...register("label")}
          />
          {errors.label && (
            <p className="text-sm text-destructive">{errors.label.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            placeholder="Short note about what this consultation groups together"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create consultation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/consultations/rounds")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
