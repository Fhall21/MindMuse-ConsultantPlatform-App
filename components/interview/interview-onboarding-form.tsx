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
  role: z.string().trim().min(1, "Role is required"),
  work_group: z.string().trim().min(1, "Work group is required"),
  organisation: z.string().trim().min(1, "Organisation is required"),
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
      role: "",
      work_group: "",
      organisation: "",
      email: undefined,
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          role: values.role.trim(),
          work_group: values.work_group.trim(),
          organisation: values.organisation.trim(),
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
        <Label htmlFor="interview-role">Role / Job title</Label>
        <Input id="interview-role" autoComplete="organization-title" {...form.register("role")} />
        {form.formState.errors.role ? (
          <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interview-work-group">Work group or team</Label>
        <Input id="interview-work-group" {...form.register("work_group")} />
        {form.formState.errors.work_group ? (
          <p className="text-sm text-destructive">{form.formState.errors.work_group.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interview-organisation">Organisation</Label>
        <Input id="interview-organisation" {...form.register("organisation")} />
        {form.formState.errors.organisation ? (
          <p className="text-sm text-destructive">{form.formState.errors.organisation.message}</p>
        ) : null}
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

      <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
        {form.formState.isSubmitting ? "Starting..." : "Start Interview"}
      </Button>
    </form>
  );
}
