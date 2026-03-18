"use client";

import { useEffect } from "react";
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
}

export function PersonForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
}: PersonFormProps) {
  const form = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      role: defaultValues?.role ?? "",
      email: defaultValues?.email ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: defaultValues?.name ?? "",
      role: defaultValues?.role ?? "",
      email: defaultValues?.email ?? "",
    });
  }, [defaultValues?.email, defaultValues?.name, defaultValues?.role, form]);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
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
