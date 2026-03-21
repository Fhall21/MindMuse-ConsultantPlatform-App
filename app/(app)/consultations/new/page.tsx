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
import { createConsultation } from "@/lib/actions/consultations";
import { useConsultationRounds } from "@/hooks/use-meetings";

const newConsultationSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  roundId: z.string().optional(),
});

type NewConsultationFormData = z.infer<typeof newConsultationSchema>;

export default function NewConsultationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { data: rounds } = useConsultationRounds();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewConsultationFormData>({
    resolver: zodResolver(newConsultationSchema),
    defaultValues: { title: "", roundId: "" },
  });

  async function onSubmit(data: NewConsultationFormData) {
    setSubmitting(true);
    try {
      const id = await createConsultation({
        title: data.title,
        roundId: data.roundId || undefined,
      });
      router.push(`/consultations/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create consultation. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Consultation</h1>
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
          <Label htmlFor="roundId">Round (optional)</Label>
          <select
            id="roundId"
            {...register("roundId")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No round</option>
            {rounds?.map((round) => (
              <option key={round.id} value={round.id}>
                {round.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create consultation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/consultations")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
