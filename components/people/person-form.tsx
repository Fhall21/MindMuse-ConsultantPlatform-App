"use client";

import { useEffect, useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { personSchema, type PersonFormData } from "@/lib/validations/consultation";
import type { Person } from "@/types/db";

interface PersonFormProps {
  defaultValues?: Partial<Person>;
  onSubmit: (data: PersonFormData) => void | Promise<void>;
  isLoading: boolean;
  submitLabel?: string;
  workingGroupOptions?: string[];
  workTypeOptions?: string[];
}

export function PersonForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  workingGroupOptions = [],
  workTypeOptions = [],
}: PersonFormProps) {
  const workingGroupListId = useId();
  const workTypeListId = useId();

  const form = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      working_group: defaultValues?.working_group ?? "",
      work_type: defaultValues?.work_type ?? "",
      role: defaultValues?.role ?? "",
      email: defaultValues?.email ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: defaultValues?.name ?? "",
      working_group: defaultValues?.working_group ?? "",
      work_type: defaultValues?.work_type ?? "",
      role: defaultValues?.role ?? "",
      email: defaultValues?.email ?? "",
    });
  }, [
    defaultValues?.email,
    defaultValues?.name,
    defaultValues?.role,
    defaultValues?.work_type,
    defaultValues?.working_group,
    form,
  ]);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          working_group: values.working_group?.trim() || undefined,
          work_type: values.work_type?.trim() || undefined,
          role: values.role?.trim() || undefined,
          email: values.email?.trim() || undefined,
        });
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="person-name">Name</Label>
        <Input
          id="person-name"
          disabled={isLoading}
          placeholder="Full name"
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="person-working-group">Working Group</Label>
        <Input
          id="person-working-group"
          list={workingGroupListId}
          disabled={isLoading}
          placeholder="Operations, Leadership, Safety..."
          {...form.register("working_group")}
        />
        <datalist id={workingGroupListId}>
          {workingGroupOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Reuse an existing working group or type a new one.
        </p>
        {form.formState.errors.working_group ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.working_group.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="person-work-type">Work Type</Label>
        <Input
          id="person-work-type"
          list={workTypeListId}
          disabled={isLoading}
          placeholder="Employee, Manager, Contractor..."
          {...form.register("work_type")}
        />
        <datalist id={workTypeListId}>
          {workTypeOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Reuse an existing work type or type a new one.
        </p>
        {form.formState.errors.work_type ? (
          <p className="text-sm text-destructive">{form.formState.errors.work_type.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="person-role">Role</Label>
        <Input
          id="person-role"
          disabled={isLoading}
          placeholder="Role (optional)"
          {...form.register("role")}
        />
        {form.formState.errors.role ? (
          <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="person-email">Email</Label>
        <Input
          id="person-email"
          type="email"
          disabled={isLoading}
          placeholder="name@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
