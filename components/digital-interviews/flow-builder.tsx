"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK,
  DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS,
  DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_ORDER,
  DIGITAL_INTERVIEW_FRAMEWORK_LABELS,
  DIGITAL_INTERVIEW_FRAMEWORKS,
  DIGITAL_INTERVIEW_FRAMEWORK_VALUES,
  getDigitalInterviewFrameworkById,
  type DigitalInterviewFrameworkCategory,
} from "@/lib/digital-interview-frameworks";
import { fetchJson } from "@/hooks/api";
import { useConsultations } from "@/hooks/use-consultations";
import type { DigitalInterviewFlowListItem } from "@/lib/data/digital-interviews";
import type { Consultation } from "@/types/db";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Consultation & title", hint: "Link to a project and name this round." },
  { label: "Framework", hint: "Choose how the AI interviewer will approach the conversation." },
  { label: "Topics & depth", hint: "Define what to cover and how deeply to probe." },
  { label: "Review", hint: "Confirm your settings before creating." },
] as const;

const DEPTH_OPTIONS = [
  {
    value: "surface",
    label: "Surface",
    time: "5–10 min",
    description: "1–2 follow-up questions per topic. Quick overview.",
  },
  {
    value: "moderate",
    label: "Moderate",
    time: "15–20 min",
    description: "3–4 follow-ups, probes for examples. Standard qualitative interview.",
  },
  {
    value: "deep",
    label: "Deep",
    time: "25–35 min",
    description: "5+ follow-ups, seeks underlying causes and systemic patterns. Rich data.",
  },
] as const;

const DEPTH_LABELS: Record<string, string> = {
  surface: "Surface — 5–10 min",
  moderate: "Moderate — 15–20 min",
  deep: "Deep — 25–35 min",
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(255),
    consultationId: z.string().nullable().optional(),
    framework: z.enum(DIGITAL_INTERVIEW_FRAMEWORK_VALUES),
    customFrameworkPrompt: z.string().trim().min(1).nullable().optional(),
    topics: z
      .array(z.object({ value: z.string().trim().min(1, "Topic cannot be empty") }))
      .min(1, "At least one topic is required")
      .max(8),
    depthLevel: z.enum(["surface", "moderate", "deep"]),
  })
  .superRefine((val, ctx) => {
    if (val.framework === "custom" && !val.customFrameworkPrompt?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["customFrameworkPrompt"],
        message: "Describe what this interview should explore",
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  0: ["title"],
  1: ["framework", "customFrameworkPrompt"],
  2: ["topics", "depthLevel"],
};

// ─── Root component ───────────────────────────────────────────────────────────

export function FlowBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);

  const { data: consultations = [] } = useConsultations();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      consultationId: null,
      framework: "appreciative_inquiry",
      customFrameworkPrompt: null,
      topics: (getDigitalInterviewFrameworkById("appreciative_inquiry")?.defaultTopics ?? []).map(
        (topic) => ({ value: topic })
      ),
      depthLevel: "moderate",
    },
    mode: "onTouched",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = form;

  const { fields: topicFields, append, remove } = useFieldArray({
    control,
    name: "topics",
  });

  const framework = watch("framework");
  const consultationId = watch("consultationId");
  const formValues = watch();

  const selectedConsultation = (consultations as Consultation[]).find(
    (c) => c.id === consultationId
  );

  function handleFrameworkChange(value: string) {
    setValue("framework", value as FormData["framework"]);
    const defaults = getDigitalInterviewFrameworkById(value as FormData["framework"]);
    setValue("topics", (defaults?.defaultTopics ?? []).map((v) => ({ value: v })));
    if (value !== "custom") {
      setValue("customFrameworkPrompt", null);
    }
  }

  async function goNext() {
    const fieldsToValidate = STEP_FIELDS[step];
    if (fieldsToValidate) {
      const valid = await trigger(fieldsToValidate);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const payload = {
        title: data.title,
        framework: data.framework,
        customFrameworkPrompt: data.customFrameworkPrompt ?? null,
        topics: data.topics.map((t) => t.value),
        depthLevel: data.depthLevel,
        consultationId: data.consultationId ?? null,
      };

      const result = await fetchJson<{ data: DigitalInterviewFlowListItem }>(
        "/api/client/digital-interviews",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      queryClient.invalidateQueries({ queryKey: ["digital_interviews"] });
      router.push(`/digital-interviews/${result.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create digital interview");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step tracker */}
      <StepTracker step={step} />

      <div className="mt-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step content */}
          <div key={step} className="animate-in fade-in duration-200">
            {step === 0 && (
              <Step1
                register={register}
                errors={errors}
                consultations={consultations as Consultation[]}
                consultationId={consultationId ?? null}
                consultationOpen={consultationOpen}
                setConsultationOpen={setConsultationOpen}
                selectedConsultation={selectedConsultation}
                onSelectConsultation={(id) => {
                  setValue("consultationId", id);
                  setConsultationOpen(false);
                }}
              />
            )}

            {step === 1 && (
              <Step2
                framework={framework}
                errors={errors}
                onFrameworkChange={handleFrameworkChange}
                register={register}
              />
            )}

            {step === 2 && (
              <Step3
                topicFields={topicFields}
                errors={errors}
                register={register}
                depthLevel={formValues.depthLevel}
                onDepthChange={(v) =>
                  setValue("depthLevel", v as FormData["depthLevel"])
                }
                onAddTopic={() => {
                  if (topicFields.length < 8) append({ value: "" });
                }}
                onRemoveTopic={remove}
              />
            )}

            {step === 3 && (
              <Step4
                values={formValues}
                selectedConsultation={selectedConsultation}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="mt-10 flex items-center justify-between border-t pt-5">
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground"
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create digital interview"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Step tracker ─────────────────────────────────────────────────────────────

function StepTracker({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      {/* Progress row */}
      <div className="flex items-center gap-1.5" role="list" aria-label="Form steps">
        {STEPS.map((s, i) => (
          <div
            key={s.label}
            role="listitem"
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i < step
                ? "bg-primary/40"
                : i === step
                ? "bg-primary"
                : "bg-border"
            )}
          />
        ))}
      </div>

      {/* Current step label */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {String(step + 1).padStart(2, "0")} / {STEPS.length}
        </span>
        <span className="text-sm font-medium">{STEPS[step].label}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          — {STEPS[step].hint}
        </span>
      </div>
    </div>
  );
}

// ─── Step 1: Consultation & title ─────────────────────────────────────────────

interface Step1Props {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
  consultations: Consultation[];
  consultationId: string | null;
  consultationOpen: boolean;
  setConsultationOpen: (v: boolean) => void;
  selectedConsultation: Consultation | undefined;
  onSelectConsultation: (id: string | null) => void;
}

function Step1({
  register,
  errors,
  consultations,
  consultationId,
  consultationOpen,
  setConsultationOpen,
  selectedConsultation,
  onSelectConsultation,
}: Step1Props) {
  return (
    <div className="space-y-7">
      <SectionHeading
        title="Interview title"
        description="A short name for this round. It will appear on the admin list and the shareable link page."
      />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. Wellbeing Survey — April 2026"
          className="max-w-lg"
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <Separator />

      <SectionHeading
        title="Consultation project"
        description="Linking to a consultation lets you combine these interview responses with in-person meeting data on the Evidence Canvas."
        optional
      />

      <div className="space-y-2">
        <Label>Consultation</Label>
        <Popover open={consultationOpen} onOpenChange={setConsultationOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={consultationOpen}
              className="w-full max-w-lg justify-between font-normal"
            >
              <span className={cn(!selectedConsultation && "text-muted-foreground")}>
                {selectedConsultation ? selectedConsultation.label : "No consultation selected"}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-40" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search consultations…" />
              <CommandList>
                <CommandEmpty>
                  {consultations.length === 0 ? (
                    <span className="text-sm">
                      No consultations yet.{" "}
                      <a href="/consultations/new" className="underline underline-offset-2">
                        Create one
                      </a>
                    </span>
                  ) : (
                    "No results."
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {consultationId && (
                    <CommandItem value="__none__" onSelect={() => onSelectConsultation(null)}>
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          !consultationId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-muted-foreground">None</span>
                    </CommandItem>
                  )}
                  {consultations.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.label}
                      onSelect={() => onSelectConsultation(c.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          consultationId === c.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {c.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ─── Step 2: Framework ────────────────────────────────────────────────────────

interface Step2Props {
  framework: FormData["framework"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
  onFrameworkChange: (v: string) => void;
  register: ReturnType<typeof useForm<FormData>>["register"];
}

function Step2({ framework, errors, onFrameworkChange, register }: Step2Props) {
  const [frameworkOpen, setFrameworkOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<DigitalInterviewFrameworkCategory | "all">(
    "all"
  );

  const selectedFramework = getDigitalInterviewFrameworkById(framework) ?? DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK;
  const categoryGroups =
    categoryFilter === "all"
      ? DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_ORDER.map((category) => ({
          category,
          frameworks: DIGITAL_INTERVIEW_FRAMEWORKS.filter(
            (definition) => definition.categories[0] === category
          ),
        })).filter((group) => group.frameworks.length > 0)
      : [
          {
            category: categoryFilter,
            frameworks: DIGITAL_INTERVIEW_FRAMEWORKS.filter((definition) =>
              definition.categories.some((frameworkCategory) => frameworkCategory === categoryFilter)
            ),
          },
        ];

  return (
    <div className="space-y-7">
      <SectionHeading
        title="Interview framework"
        description="Choose the approach the AI interviewer will use to guide the conversation."
      />

      <div className="space-y-2">
        <Label>Framework</Label>
        <Popover open={frameworkOpen} onOpenChange={setFrameworkOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={frameworkOpen}
              className="w-full max-w-2xl justify-between font-normal"
            >
              <span className={cn(!selectedFramework && "text-muted-foreground")}>{selectedFramework?.label ?? "Select a framework"}</span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-40" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search frameworks…" />
              <div className="flex flex-wrap gap-2 border-b px-3 py-3">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    categoryFilter === "all"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                  )}
                >
                  All categories
                </button>
                {DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_ORDER.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      categoryFilter === category
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                    )}
                  >
                    {DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
              <CommandList>
                <CommandEmpty>No frameworks match this search.</CommandEmpty>
                {categoryGroups.map(({ category, frameworks }) => (
                  <CommandGroup key={category} heading={DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS[category]}>
                    {frameworks.map((opt) => (
                      <CommandItem
                        key={opt.id}
                        value={`${opt.label} ${opt.description} ${opt.categories
                          .map((cat) => DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS[cat])
                          .join(" ")}`}
                        onSelect={() => {
                          onFrameworkChange(opt.id);
                          setFrameworkOpen(false);
                        }}
                        className="items-start py-2.5"
                      >
                        <Check
                          className={cn(
                            "mr-2 mt-0.5 size-4 shrink-0",
                            framework === opt.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-none">{opt.label}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS[category]}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{opt.description}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
                <CommandGroup heading="Custom">
                  <CommandItem
                    value={`${DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK.label} ${DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK.description}`}
                    onSelect={() => {
                      onFrameworkChange("custom");
                      setFrameworkOpen(false);
                    }}
                    className="items-start py-2.5"
                  >
                    <Check
                      className={cn(
                        "mr-2 mt-0.5 size-4 shrink-0",
                        framework === "custom" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium leading-none">Custom</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Freeform
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You define the interview&apos;s focus. Provide a brief description and the AI will use it as its guiding intent.
                      </p>
                    </div>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {errors.framework && (
        <p className="text-sm text-destructive">{errors.framework.message}</p>
      )}

      {framework === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="customFrameworkPrompt">Interview focus</Label>
          <Textarea
            id="customFrameworkPrompt"
            placeholder="Describe what this interview should explore and why. The AI interviewer will use this as its guiding intent."
            rows={4}
            className="max-w-lg resize-none"
            {...register("customFrameworkPrompt")}
          />
          {errors.customFrameworkPrompt && (
            <p className="text-sm text-destructive">
              {errors.customFrameworkPrompt.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Topics & depth ───────────────────────────────────────────────────

interface Step3Props {
  topicFields: ReturnType<typeof useFieldArray<FormData, "topics">>["fields"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
  register: ReturnType<typeof useForm<FormData>>["register"];
  depthLevel: FormData["depthLevel"];
  onDepthChange: (v: string) => void;
  onAddTopic: () => void;
  onRemoveTopic: (index: number) => void;
}

function Step3({
  topicFields,
  errors,
  register,
  depthLevel,
  onDepthChange,
  onAddTopic,
  onRemoveTopic,
}: Step3Props) {
  return (
    <div className="space-y-10">
      {/* Topics */}
      <div className="space-y-5">
        <SectionHeading
          title="Topic areas"
          description={`The subjects the interview should cover. Between 1 and 8 topics. ${topicFields.length}/8 added.`}
        />

        <div className="space-y-2">
          {topicFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Input
                placeholder={`Topic ${index + 1}`}
                className="flex-1"
                {...register(`topics.${index}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveTopic(index)}
                disabled={topicFields.length === 1}
                aria-label="Remove topic"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          {/* Root-level topics error (e.g. "at least one required") */}
          {errors.topics && !Array.isArray(errors.topics) && (
            <p className="text-sm text-destructive">{errors.topics.message}</p>
          )}
          {/* Per-item errors */}
          {Array.isArray(errors.topics) &&
            errors.topics.map(
              (e, i) =>
                e?.value && (
                  <p key={i} className="text-sm text-destructive">
                    Topic {i + 1}: {e.value.message}
                  </p>
                )
            )}

          {topicFields.length < 8 && (
            <button
              type="button"
              onClick={onAddTopic}
              className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add topic
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Depth */}
      <div className="space-y-5">
        <SectionHeading
          title="Depth level"
          description="How deeply should the AI probe each topic?"
        />

        <RadioGroup
          value={depthLevel}
          onValueChange={onDepthChange}
          className="gap-2"
        >
          {DEPTH_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`depth-${opt.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
                depthLevel === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/25"
              )}
            >
              <RadioGroupItem
                id={`depth-${opt.value}`}
                value={opt.value}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium leading-none">{opt.label}</p>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {opt.time}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        {errors.depthLevel && (
          <p className="text-sm text-destructive">{errors.depthLevel.message}</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

interface Step4Props {
  values: FormData;
  selectedConsultation: Consultation | undefined;
}

function Step4({ values, selectedConsultation }: Step4Props) {
  return (
    <div className="space-y-7">
      <SectionHeading
        title="Review"
        description="Check your settings before creating the digital interview."
      />

      <div className="rounded-md border">
        <ReviewRow label="Title" value={values.title} />
        <ReviewRow
          label="Consultation"
          value={selectedConsultation?.label ?? "None"}
          muted={!selectedConsultation}
        />
        <ReviewRow
          label="Framework"
          value={DIGITAL_INTERVIEW_FRAMEWORK_LABELS[values.framework] ?? values.framework}
        />
        {values.framework === "custom" && values.customFrameworkPrompt && (
          <ReviewRow label="Interview focus" value={values.customFrameworkPrompt} multiline />
        )}
        <ReviewRow
          label="Topics"
          value={values.topics.map((t, i) => `${i + 1}. ${t.value}`).join("\n")}
          multiline
        />
        <ReviewRow
          label="Depth"
          value={DEPTH_LABELS[values.depthLevel] ?? values.depthLevel}
          last
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Once created, you will be shown a shareable link to send to interviewees.
        You can activate it from the interview detail page.
      </p>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  muted,
  multiline,
  last,
}: {
  label: string;
  value: string;
  muted?: boolean;
  multiline?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-6 px-4 py-3",
        !last && "border-b"
      )}
    >
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "flex-1 text-sm",
          muted && "text-muted-foreground",
          multiline && "whitespace-pre-line"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Shared: Section heading ──────────────────────────────────────────────────

function SectionHeading({
  title,
  description,
  optional,
}: {
  title: string;
  description: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {optional && (
          <span className="text-xs text-muted-foreground">optional</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
