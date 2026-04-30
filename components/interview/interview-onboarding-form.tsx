"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InterviewOnboardingValues } from "@/hooks/use-interview-session";

const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  workType: z.string().trim().min(1, "Work type is required"),
  work_group: z.string().trim().min(1, "Work group is required"),
  organisation: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
});

interface InterviewOnboardingFormProps {
  onSubmit: (values: InterviewOnboardingValues) => Promise<void>;
}

export function InterviewOnboardingForm({ onSubmit }: InterviewOnboardingFormProps) {
  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      workType: "",
      work_group: "",
      organisation: "",
      email: undefined,
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        const organisation = values.organisation?.trim();

        await onSubmit({
          name: values.name.trim(),
          workType: values.workType.trim(),
          work_group: values.work_group.trim(),
          organisation: organisation && organisation.length > 0 ? organisation : undefined,
          email: values.email?.trim() || undefined,
        });
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="interview-name">Name</Label>
        <Input id="interview-name" autoComplete="name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interview-work-type">Work type</Label>
        <Input id="interview-work-type" autoComplete="organization-title" {...form.register("workType")} />
        <p className="text-sm text-muted-foreground">Job title, practice type, or other role descriptor.</p>
        {form.formState.errors.workType ? (
          <p className="text-sm text-destructive">{form.formState.errors.workType.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interview-work-group">Work group or team</Label>
        <Input id="interview-work-group" {...form.register("work_group")} />
        {form.formState.errors.work_group ? (
          <p className="text-sm text-destructive">{form.formState.errors.work_group.message}</p>
        ) : null}
      </div>

      <details className="group rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
          Optional details
        </summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interview-organisation">Organisation</Label>
            <Input id="interview-organisation" {...form.register("organisation")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-email">Email</Label>
            <Input
              id="interview-email"
              type="email"
              autoComplete="email"
              {...form.register("email", {
                setValueAs: (value) => {
                  if (typeof value !== "string") {
                    return undefined;
                  }

                  const trimmed = value.trim();
                  return trimmed.length > 0 ? trimmed : undefined;
                },
              })}
            />
            <p className="text-sm text-muted-foreground">
              Optional. Only used if your consultant wants to follow up.
            </p>
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
        </div>
      </details>

      <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
        {form.formState.isSubmitting ? "Starting..." : "Start Interview"}
      </Button>
    </form>
  );
}
