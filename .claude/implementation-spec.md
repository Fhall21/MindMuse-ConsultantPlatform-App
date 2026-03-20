# Implementation Spec: AI Personalization for Theme Generation

**Based on:** Mega Plan Review (EXPANSION mode, all decisions locked)
**PR Scope:** Database rename + Settings UI + Preferences API (AI wiring deferred to next PR)
**Status:** Ready for implementation

---

## Part 1: File Structure & New Files

### Files to Create

```
app/(app)/settings/ai-personalisation/
├── page.tsx                              [Main settings page]
├── layout.tsx                            [Tab layout]
├── error.tsx                             [Error boundary]
└── loading.tsx                           [Loading state]

components/AIPersonalisation/
├── index.ts                              [Export barrel]
├── SignalsList.tsx                       [Past decisions table]
├── SignalsListItem.tsx                   [Single signal row]
├── PreferencesForm.tsx                   [Preferences form]
├── InsightsSummary.tsx                   [AI analysis dashboard]
├── InsightsSummaryLoading.tsx            [Skeleton for AI summary]
└── AIPersonalisationTabs.tsx             [Tabbed layout]

lib/validations/
├── ai-preferences.ts                     [Zod schemas for validation]
└── index.ts                              [Export barrel]

lib/utils/
├── format-preferences.ts                 [Display formatting]
├── ai-preferences-queries.ts             [DB query helpers]
└── index.ts                              [Export barrel]

db/schema/
└── user-ai-preferences.ts                [Drizzle schema]

app/api/user/
├── ai-preferences/
│   ├── route.ts                          [GET + PATCH endpoints]
│   └── signals/
│       └── [id]/
│           └── route.ts                  [DELETE endpoint]
└── ai-insights-summary/
    └── route.ts                          [GET endpoint]

hooks/
├── useAIPreferences.ts                   [Query hook]
├── useUpdateAIPreferences.ts             [Mutation hook]
├── useAIInsightSignals.ts                [Signals list hook]
└── useAIInsightsSummary.ts               [AI analysis hook]

types/
└── ai-personalisation.ts                 [TypeScript types]

db/migrations/
└── xxxxxxx-rename-themes-add-preferences.ts  [Database migration]

tests/
├── ai-preferences.test.ts                [Validation tests]
├── api/
│   └── user/
│       ├── ai-preferences.test.ts        [API endpoint tests]
│       └── ai-insights-summary.test.ts   [AI summary endpoint tests]
└── components/
    └── ai-personalisation/
        ├── SignalsList.test.tsx          [Component tests]
        └── PreferencesForm.test.tsx      [Form tests]
```

### Files to Modify

```
db/schema/index.ts                        [Export new table]
db/schema/domain.ts                       [Update references after rename]
app/(app)/settings/layout.tsx             [Add AI Personalisation nav]
app/(app)/settings/page.tsx               [Add AI Personalisation link]
types/index.ts                            [Export new types]
lib/openai/index.ts                       [Note: AI calling deferred to next PR]
```

---

## Part 2: Database Schema & Migrations

### New Table Definition

**File:** `db/schema/user-ai-preferences.ts`

```typescript
import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const userAIPreferences = pgTable(
  "user_ai_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    consultationTypes: jsonb("consultation_types")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    focusAreas: jsonb("focus_areas")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    excludedTopics: jsonb("excluded_topics")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("idx_user_ai_preferences_user_id").on(table.userId),
    updatedAtIdx: index("idx_user_ai_preferences_updated_at").on(
      table.updatedAt
    ),
  })
);
```

### Database Migration

**File:** `db/migrations/xxxxxxx-rename-themes-add-preferences.ts` (use actual timestamp)

```typescript
import { sql } from "drizzle-orm";

export async function up(db: any) {
  // Step 1: Rename existing tables
  await db.execute(sql`
    ALTER TABLE themes RENAME TO insights;
  `);
  await db.execute(sql`
    ALTER TABLE theme_decision_logs RENAME TO insight_decision_logs;
  `);
  await db.execute(sql`
    ALTER TABLE round_theme_groups RENAME TO themes;
  `);
  await db.execute(sql`
    ALTER TABLE round_theme_group_members RENAME TO theme_group_members;
  `);

  // Step 2: Rename foreign key constraints and indexes
  // (Drizzle/PostgreSQL handles most automatically, but verify)

  // Step 3: Create new user_ai_preferences table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_ai_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      consultation_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      focus_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      excluded_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // Step 4: Create critical indexes
  await db.execute(sql`
    CREATE INDEX idx_user_ai_preferences_user_id
    ON user_ai_preferences(user_id);
  `);
  await db.execute(sql`
    CREATE INDEX idx_user_ai_preferences_updated_at
    ON user_ai_preferences(updated_at);
  `);

  // CRITICAL: Index for signals queries (was missing, causing full table scans)
  await db.execute(sql`
    CREATE INDEX idx_insight_decision_logs_user_created
    ON insight_decision_logs(user_id, created_at DESC);
  `);

  // Step 5: Create backward-compatibility views (grace period for old code)
  await db.execute(sql`
    CREATE VIEW themes_compat AS SELECT * FROM insights;
  `);
  await db.execute(sql`
    CREATE VIEW theme_decision_logs_compat AS SELECT * FROM insight_decision_logs;
  `);
  await db.execute(sql`
    CREATE VIEW round_theme_groups_compat AS SELECT * FROM themes;
  `);

  // Step 6: Audit log for migration itself
  console.log("✓ Migration complete: themes renamed to insights, new user_ai_preferences table created");
}

export async function down(db: any) {
  // Rollback (reverse order)

  // Drop views first
  await db.execute(sql`DROP VIEW IF EXISTS themes_compat;`);
  await db.execute(sql`DROP VIEW IF EXISTS theme_decision_logs_compat;`);
  await db.execute(sql`DROP VIEW IF EXISTS round_theme_groups_compat;`);

  // Drop new table
  await db.execute(sql`DROP TABLE IF EXISTS user_ai_preferences CASCADE;`);

  // Rename tables back (reverse the renames)
  await db.execute(sql`ALTER TABLE theme_group_members RENAME TO round_theme_group_members;`);
  await db.execute(sql`ALTER TABLE themes RENAME TO round_theme_groups;`);
  await db.execute(sql`ALTER TABLE insight_decision_logs RENAME TO theme_decision_logs;`);
  await db.execute(sql`ALTER TABLE insights RENAME TO themes;`);

  console.log("✓ Migration rolled back");
}
```

---

## Part 3: TypeScript Types

**File:** `types/ai-personalisation.ts`

```typescript
import { z } from "zod";

// ============ SCHEMAS (Zod) ============

export const AIPreferencesSchema = z.object({
  consultationTypes: z.array(z.string().max(100)).max(5).default([]),
  focusAreas: z.array(z.string().max(200)).max(10).default([]),
  excludedTopics: z.array(z.string().max(200)).max(10).default([]),
});

export const AISignalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  consultationId: z.string().uuid().nullable(),
  themeId: z.string().uuid().nullable(),
  themeLabel: z.string(),
  decisionType: z.enum(["accept", "reject", "user_added"]),
  rationale: z.string().max(500).optional(),
  weight: z.number().positive(),
  createdAt: z.date(),
});

export const UpdateAISignalRationaleSchema = z.object({
  rationale: z.string().max(500).optional(),
});

export const AIInsightsSummarySchema = z.object({
  summary: z.string().max(2000),
  patterns: z.array(z.string()).max(5),
  suggestions: z.array(z.string()).max(3),
});

// ============ TYPES (TypeScript) ============

export type AIPreferences = z.infer<typeof AIPreferencesSchema>;
export type AISignal = z.infer<typeof AISignalSchema>;
export type UpdateAISignalRationale = z.infer<
  typeof UpdateAISignalRationaleSchema
>;
export type AIInsightsSummary = z.infer<typeof AIInsightsSummarySchema>;

export interface AIPreferencesWithMetadata extends AIPreferences {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  signalCount: number;
}

export interface APIResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## Part 4: Validation Schemas

**File:** `lib/validations/ai-preferences.ts`

```typescript
import { z } from "zod";

// Strict validation (server-side + client-side)
export const AIPreferencesValidation = z.object({
  consultationTypes: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Type cannot be empty")
        .max(100, "Type exceeds 100 characters")
        .regex(/^[a-zA-Z0-9\s\-,]+$/, "Type contains invalid characters")
    )
    .max(5, "Maximum 5 consultation types allowed")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "Duplicate consultation types not allowed"
    ),

  focusAreas: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Focus area cannot be empty")
        .max(200, "Focus area exceeds 200 characters")
        .regex(/^[a-zA-Z0-9\s\-,.()]+$/, "Focus area contains invalid characters")
    )
    .max(10, "Maximum 10 focus areas allowed")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "Duplicate focus areas not allowed"
    ),

  excludedTopics: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Topic cannot be empty")
        .max(200, "Topic exceeds 200 characters")
        .regex(/^[a-zA-Z0-9\s\-,.()]+$/, "Topic contains invalid characters")
    )
    .max(10, "Maximum 10 excluded topics allowed")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "Duplicate excluded topics not allowed"
    ),
});

export type AIPreferencesInput = z.infer<typeof AIPreferencesValidation>;

export const validateAIPreferences = (
  data: unknown
): { valid: true; data: AIPreferencesInput } | { valid: false; errors: Record<string, string> } => {
  const result = AIPreferencesValidation.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });
  return { valid: false, errors };
};
```

---

## Part 5: API Endpoints

### GET /api/user/ai-preferences

**File:** `app/api/user/ai-preferences/route.ts`

```typescript
import { getSession } from "@/lib/auth";
import { db } from "@/db/client";
import { userAIPreferences } from "@/db/schema/user-ai-preferences";
import { eq } from "drizzle-orm";
import { APIResponse, AIPreferencesWithMetadata } from "@/types/ai-personalisation";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const logger = getLogger("api:ai-preferences:get");
    logger.debug("fetch_ai_preferences", { userId: session.user.id });

    // Query preferences
    const prefs = await db
      .select()
      .from(userAIPreferences)
      .where(eq(userAIPreferences.userId, session.user.id))
      .limit(1);

    if (prefs.length === 0) {
      logger.info("fetch_ai_preferences_not_found", { userId: session.user.id });

      // Auto-init: insert blank row
      const newPrefs = await db
        .insert(userAIPreferences)
        .values({
          userId: session.user.id,
          consultationTypes: [],
          focusAreas: [],
          excludedTopics: [],
        })
        .returning();

      const signalCount = await getSignalCountForUser(session.user.id);

      return Response.json(
        {
          data: {
            ...newPrefs[0],
            signalCount,
          },
        } as APIResponse<AIPreferencesWithMetadata>,
        { status: 200 }
      );
    }

    const prefs_row = prefs[0];
    const signalCount = await getSignalCountForUser(session.user.id);

    logger.debug("fetch_ai_preferences_completed", { userId: session.user.id });

    return Response.json(
      {
        data: {
          ...prefs_row,
          signalCount,
        },
      } as APIResponse<AIPreferencesWithMetadata>,
      { status: 200 }
    );
  } catch (error) {
    logger.error("fetch_ai_preferences_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}
```

### PATCH /api/user/ai-preferences

**File:** `app/api/user/ai-preferences/route.ts` (same file, add PATCH)

```typescript
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const logger = getLogger("api:ai-preferences:patch");
    const body = await req.json();

    // Validate input
    const validation = validateAIPreferences(body);
    if (!validation.valid) {
      logger.warn("update_ai_preferences_validation_failed", {
        userId: session.user.id,
        errors: validation.errors,
      });
      return Response.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const validated = validation.data;
    const now = new Date();

    logger.info("update_ai_preferences_started", {
      userId: session.user.id,
      changes: validated,
    });

    // Get current preferences for audit
    const current = await db
      .select()
      .from(userAIPreferences)
      .where(eq(userAIPreferences.userId, session.user.id))
      .limit(1);

    const oldValues = current[0] || null;

    // Upsert with updated_at (optimistic lock check)
    const updated = await db
      .insert(userAIPreferences)
      .values({
        userId: session.user.id,
        consultationTypes: validated.consultationTypes,
        focusAreas: validated.focusAreas,
        excludedTopics: validated.excludedTopics,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userAIPreferences.userId,
        set: {
          consultationTypes: validated.consultationTypes,
          focusAreas: validated.focusAreas,
          excludedTopics: validated.excludedTopics,
          updatedAt: now,
        },
      })
      .returning();

    const newValues = updated[0];

    // Audit log: field-level detail
    await logToAuditTrail({
      userId: session.user.id,
      action: "updated_ai_preferences",
      entityType: "user_ai_preferences",
      entityId: session.user.id,
      payload: {
        old: oldValues
          ? {
              consultationTypes: oldValues.consultationTypes,
              focusAreas: oldValues.focusAreas,
              excludedTopics: oldValues.excludedTopics,
            }
          : null,
        new: {
          consultationTypes: newValues.consultationTypes,
          focusAreas: newValues.focusAreas,
          excludedTopics: newValues.excludedTopics,
        },
      },
    });

    const signalCount = await getSignalCountForUser(session.user.id);

    logger.info("update_ai_preferences_completed", {
      userId: session.user.id,
      updatedAt: newValues.updatedAt,
    });

    return Response.json(
      {
        data: {
          ...newValues,
          signalCount,
        },
        message: "Preferences saved",
      } as APIResponse<AIPreferencesWithMetadata>,
      { status: 200 }
    );
  } catch (error) {
    logger.error("update_ai_preferences_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
```

### DELETE /api/user/ai-preferences/signals/[id]

**File:** `app/api/user/ai-preferences/signals/[id]/route.ts`

```typescript
import { getSession } from "@/lib/auth";
import { db } from "@/db/client";
import { insightDecisionLogs } from "@/db/schema/domain";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logger = getLogger("api:insight-signals:delete");
    const signalId = params.id;

    logger.info("delete_signal_started", {
      userId: session.user.id,
      signalId,
    });

    // Verify signal belongs to user
    const signal = await db
      .select()
      .from(insightDecisionLogs)
      .where(eq(insightDecisionLogs.id, signalId))
      .limit(1);

    if (signal.length === 0) {
      logger.warn("delete_signal_not_found", {
        userId: session.user.id,
        signalId,
      });
      return Response.json(
        { error: "Signal not found" },
        { status: 404 }
      );
    }

    if (signal[0].userId !== session.user.id) {
      logger.warn("delete_signal_unauthorized", {
        userId: session.user.id,
        signalId,
        actualUserId: signal[0].userId,
      });
      return Response.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete signal
    await db
      .delete(insightDecisionLogs)
      .where(eq(insightDecisionLogs.id, signalId));

    // Audit log
    await logToAuditTrail({
      userId: session.user.id,
      action: "deleted_insight_signal",
      entityType: "insight_decision_logs",
      entityId: signalId,
      payload: { signal: signal[0] },
    });

    logger.info("delete_signal_completed", {
      userId: session.user.id,
      signalId,
    });

    return Response.json(
      { message: "Signal deleted" },
      { status: 200 }
    );
  } catch (error) {
    logger.error("delete_signal_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to delete signal" },
      { status: 500 }
    );
  }
}
```

### GET /api/user/ai-insights-summary

**File:** `app/api/user/ai-insights-summary/route.ts`

**NOTE: This endpoint is deferred to NEXT PR (requires AI service calls)**

Stub for now:
```typescript
export async function GET(req: Request) {
  return Response.json(
    { message: "AI insights coming in next PR" },
    { status: 501 } // Not Implemented
  );
}
```

---

## Part 6: React Components

### Settings Page

**File:** `app/(app)/settings/ai-personalisation/page.tsx`

```typescript
"use client";

import { Suspense } from "react";
import { AIPersonalisationTabs } from "@/components/AIPersonalisation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function AIPersonalisationPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">AI Personalisation</h1>
        <p className="text-muted-foreground">
          Customize how the AI generates insights based on your consultation style
          and preferences.
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <AIPersonalisationTabs />
      </Suspense>
    </div>
  );
}
```

### Preferences Form Component

**File:** `components/AIPersonalisation/PreferencesForm.tsx`

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AIPreferencesValidation } from "@/lib/validations/ai-preferences";
import { useUpdateAIPreferences } from "@/hooks/useUpdateAIPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";

export function PreferencesForm() {
  const { mutate: updatePreferences, isPending } = useUpdateAIPreferences();
  const [consultationTypeInput, setConsultationTypeInput] = useState("");
  const [focusAreaInput, setFocusAreaInput] = useState("");
  const [excludedTopicInput, setExcludedTopicInput] = useState("");

  const form = useForm({
    resolver: zodResolver(AIPreferencesValidation),
    defaultValues: {
      consultationTypes: [],
      focusAreas: [],
      excludedTopics: [],
    },
  });

  const consultationTypes = form.watch("consultationTypes");
  const focusAreas = form.watch("focusAreas");
  const excludedTopics = form.watch("excludedTopics");

  const handleAddConsultationType = () => {
    if (consultationTypeInput.trim()) {
      if (!consultationTypes.includes(consultationTypeInput.trim())) {
        form.setValue("consultationTypes", [
          ...consultationTypes,
          consultationTypeInput.trim(),
        ]);
        setConsultationTypeInput("");
      } else {
        toast.error("Duplicate consultation type");
      }
    }
  };

  // Similar handlers for focusAreas and excludedTopics...

  const handleRemoveType = (index: number) => {
    form.setValue(
      "consultationTypes",
      consultationTypes.filter((_, i) => i !== index)
    );
  };

  // Similar remove handlers...

  const onSubmit = (data: typeof AIPreferencesValidation._type) => {
    updatePreferences(data, {
      onSuccess: () => {
        toast.success("Preferences saved");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to save preferences");
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Consultation Types Field */}
        <FormField
          control={form.control}
          name="consultationTypes"
          render={() => (
            <FormItem>
              <FormLabel>Consultation Types</FormLabel>
              <FormDescription>
                What types of consultations do you primarily conduct?
              </FormDescription>
              <div className="space-y-3">
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Psychosocial, Design Thinking"
                      value={consultationTypeInput}
                      onChange={(e) => setConsultationTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddConsultationType();
                        }
                      }}
                      maxLength={100}
                    />
                    <Button
                      type="button"
                      onClick={handleAddConsultationType}
                      disabled={!consultationTypeInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </FormControl>
                <div className="flex flex-wrap gap-2">
                  {consultationTypes.map((type, idx) => (
                    <Badge key={idx} variant="secondary">
                      {type}
                      <button
                        type="button"
                        onClick={() => handleRemoveType(idx)}
                        className="ml-1 hover:opacity-70"
                      >
                        <X size={14} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Focus Areas Field (similar structure) */}

        {/* Excluded Topics Field (similar structure) */}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </form>
    </Form>
  );
}
```

### Signals List Component

**File:** `components/AIPersonalisation/SignalsList.tsx`

```typescript
"use client";

import { useAIInsightSignals } from "@/hooks/useAIInsightSignals";
import { SignalsListItem } from "./SignalsListItem";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircle } from "lucide-react";

export function SignalsList() {
  const { data: signals, isLoading, error } = useAIInsightSignals();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div className="text-sm text-destructive">Failed to load signals</div>
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No feedback yet. Run your first consultation to see personalization signals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Your Decision History</h3>
      <div className="space-y-2">
        {signals.map((signal) => (
          <SignalsListItem key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
```

### Single Signal Item

**File:** `components/AIPersonalisation/SignalsListItem.tsx`

```typescript
"use client";

import { useState } from "react";
import { AISignal } from "@/types/ai-personalisation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeleteSignal } from "@/hooks/useDeleteSignal";
import { Edit2, Trash2, Pin, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function SignalsListItem({ signal }: { signal: AISignal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editedRationale, setEditedRationale] = useState(signal.rationale || "");
  const { mutate: deleteSignal, isPending: isDeleting } = useDeleteSignal();

  const handleDelete = () => {
    deleteSignal(signal.id, {
      onSuccess: () => {
        toast.success("Signal deleted");
      },
      onError: () => {
        toast.error("Failed to delete signal");
      },
    });
  };

  const decisionColors = {
    accept: "bg-green-100 text-green-800",
    reject: "bg-red-100 text-red-800",
    user_added: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Badge className={decisionColors[signal.decisionType]}>
        {signal.decisionType === "user_added"
          ? "Added"
          : signal.decisionType === "accept"
            ? "Accepted"
            : "Rejected"}
      </Badge>
      <div className="flex-1">
        <p className="font-medium">{signal.themeLabel}</p>
        {signal.rationale && (
          <p className="text-sm text-muted-foreground">{signal.rationale}</p>
        )}
      </div>
      <div className="flex gap-1">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Edit2 size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Rationale</DialogTitle>
              <DialogDescription>
                Why did you make this decision?
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={editedRationale}
              onChange={(e) => setEditedRationale(e.target.value)}
              maxLength={500}
              placeholder="Optional: explain your reasoning"
            />
            <Button
              onClick={() => {
                // TODO: Implement update rationale endpoint
                setIsOpen(false);
                toast.success("Rationale updated");
              }}
            >
              Save
            </Button>
          </DialogContent>
        </Dialog>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}
```

---

## Part 7: React Hooks (Query & Mutation)

### useAIPreferences Hook

**File:** `hooks/useAIPreferences.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { AIPreferencesWithMetadata } from "@/types/ai-personalisation";

export function useAIPreferences() {
  return useQuery<AIPreferencesWithMetadata>({
    queryKey: ["ai-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const json = await res.json();
      return json.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}
```

### useUpdateAIPreferences Mutation Hook

**File:** `hooks/useUpdateAIPreferences.ts`

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AIPreferences } from "@/types/ai-personalisation";

export function useUpdateAIPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AIPreferences) => {
      const res = await fetch("/api/user/ai-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update preferences");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["ai-signals"] });
    },
  });
}
```

### useAIInsightSignals Hook

**File:** `hooks/useAIInsightSignals.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { AISignal } from "@/types/ai-personalisation";

export function useAIInsightSignals() {
  return useQuery<AISignal[]>({
    queryKey: ["ai-signals"],
    queryFn: async () => {
      // TODO: Implement GET /api/user/ai-signals endpoint
      // For now, return empty array
      return [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
```

### useDeleteSignal Mutation Hook

**File:** `hooks/useDeleteSignal.ts`

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signalId: string) => {
      const res = await fetch(`/api/user/ai-preferences/signals/${signalId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete signal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-signals"] });
    },
  });
}
```

---

## Part 8: Test Specifications

### Validation Tests

**File:** `tests/ai-preferences.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { AIPreferencesValidation } from "@/lib/validations/ai-preferences";

describe("AIPreferencesValidation", () => {
  it("accepts valid preferences", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["Psychosocial", "Design Thinking"],
      focusAreas: ["Emotional patterns", "Team dynamics"],
      excludedTopics: ["Administrative"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects consultationTypes exceeding max length", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["x".repeat(101)],
      focusAreas: [],
      excludedTopics: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate consultation types", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["Psychosocial", "Psychosocial"],
      focusAreas: [],
      excludedTopics: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 consultation types", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["A", "B", "C", "D", "E", "F"],
      focusAreas: [],
      excludedTopics: [],
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from inputs", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["  Psychosocial  "],
      focusAreas: ["  Emotional patterns  "],
      excludedTopics: ["  Admin  "],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consultationTypes[0]).toBe("Psychosocial");
    }
  });

  it("rejects invalid characters", () => {
    const result = AIPreferencesValidation.safeParse({
      consultationTypes: ["Psychosocial<script>"],
      focusAreas: [],
      excludedTopics: [],
    });
    expect(result.success).toBe(false);
  });
});
```

### API Endpoint Tests

**File:** `tests/api/user/ai-preferences.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createMocks } from "node-mocks-http";
import { GET, PATCH } from "@/app/api/user/ai-preferences/route";

describe("GET /api/user/ai-preferences", () => {
  it("returns 401 if not authenticated", async () => {
    const { req, res } = createMocks({ method: "GET" });
    // Mock getSession to return null
    await GET(req);
    expect(res._getStatusCode()).toBe(401);
  });

  it("auto-initializes preferences for new user", async () => {
    // Mock authenticated session
    // Mock empty DB query result
    // Call GET
    // Assert: 200 response + empty preferences returned
  });

  it("returns existing preferences", async () => {
    // Mock authenticated session
    // Mock DB query result with existing preferences
    // Call GET
    // Assert: 200 response + preferences with metadata
  });
});

describe("PATCH /api/user/ai-preferences", () => {
  it("returns 400 if validation fails", async () => {
    // Mock authenticated session
    // Mock body with invalid data (> 5 consultation types)
    // Call PATCH
    // Assert: 400 response + validation errors
  });

  it("updates preferences and logs to audit trail", async () => {
    // Mock authenticated session
    // Mock valid request body
    // Mock DB upsert
    // Mock audit log write
    // Call PATCH
    // Assert: 200 response + preferences updated
    // Assert: audit log called with field-level details
  });

  it("handles optimistic lock conflict gracefully", async () => {
    // Mock concurrent update scenario
    // Assert: returns appropriate response (409 or overwrites with warning)
  });
});
```

### Component Tests

**File:** `tests/components/ai-personalisation/PreferencesForm.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreferencesForm } from "@/components/AIPersonalisation/PreferencesForm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("PreferencesForm", () => {
  const queryClient = new QueryClient();

  it("renders form fields", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PreferencesForm />
      </QueryClientProvider>
    );
    expect(screen.getByLabelText(/Consultation Types/i)).toBeInTheDocument();
  });

  it("adds consultation type on Enter key", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PreferencesForm />
      </QueryClientProvider>
    );
    const input = screen.getByPlaceholderText(/e.g., Psychosocial/i);
    fireEvent.change(input, { target: { value: "Psychosocial" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("Psychosocial")).toBeInTheDocument();
    });
  });

  it("prevents duplicate consultation types", async () => {
    // ... add same type twice
    // Assert: toast error shown
  });

  it("submits form with PATCH request", async () => {
    // Mock updatePreferences mutation
    // Fill form + click Save
    // Assert: mutation called with correct data
  });

  it("disables Save button while submitting", async () => {
    // Mock slow mutation
    // Click Save
    // Assert: button disabled and shows "Saving..."
  });
});
```

---

## Part 9: Implementation Order

**Execute in this sequence:**

1. **Database & Schema** (foundational)
   - Create `db/schema/user-ai-preferences.ts`
   - Create migration file
   - Run migration locally, test rollback

2. **Types & Validation** (low-risk, no dependencies)
   - `types/ai-personalisation.ts`
   - `lib/validations/ai-preferences.ts`
   - Unit tests for validation

3. **API Endpoints** (core functionality)
   - `app/api/user/ai-preferences/route.ts` (GET + PATCH)
   - `app/api/user/ai-preferences/signals/[id]/route.ts` (DELETE)
   - Stub `app/api/user/ai-insights-summary/route.ts`
   - Integration tests for APIs

4. **React Hooks** (glue layer)
   - `hooks/useAIPreferences.ts`
   - `hooks/useUpdateAIPreferences.ts`
   - `hooks/useAIInsightSignals.ts`
   - `hooks/useDeleteSignal.ts`

5. **UI Components** (user-facing)
   - `components/AIPersonalisation/PreferencesForm.tsx`
   - `components/AIPersonalisation/SignalsList.tsx`
   - `components/AIPersonalisation/SignalsListItem.tsx`
   - `components/AIPersonalisation/AIPersonalisationTabs.tsx` (wrapper)
   - Component tests

6. **Settings Page Integration** (entry point)
   - `app/(app)/settings/ai-personalisation/page.tsx`
   - Update `app/(app)/settings/layout.tsx` to add nav link
   - E2E tests

7. **Documentation & Cleanup**
   - Update README with new section
   - Update CHANGELOG
   - Add JSDoc comments to public functions

---

## Part 10: Success Criteria

### Definition of Done (This PR)

- [ ] Database migration tested (forward + rollback)
- [ ] All new API endpoints return correct status codes
- [ ] Settings page loads and renders without errors
- [ ] Preferences can be saved and retrieved
- [ ] Signals can be deleted with audit trail
- [ ] Validation prevents invalid input
- [ ] Optimistic lock prevents concurrent conflicts
- [ ] Field-level audit logging works
- [ ] Unit tests: 100% coverage for validation
- [ ] Integration tests: all API paths covered
- [ ] Component tests: happy path + edge cases
- [ ] E2E test: user opens settings → edits → saves → sees confirmation
- [ ] No console errors or warnings
- [ ] Accessibility: form labels, ARIA attributes
- [ ] Mobile responsive
- [ ] Code review approved + merged

### Metrics to Verify

- [ ] Settings page loads < 500ms (with cold DB)
- [ ] PATCH preferences completes < 1s
- [ ] No N+1 queries
- [ ] Signals list loads < 2s for user with 1000 signals
- [ ] Audit log entries created for all preference changes
- [ ] Zero 500 errors in test runs

---

## Part 11: Deferred (Next PR)

- [ ] Learning adapter integration (requires hardening first)
- [ ] AI insights summary endpoint (requires API wiring)
- [ ] Prompt injection test suite (test after AI integration)
- [ ] OpenAI 429 retry logic (test during AI integration)
- [ ] Preferences caching (performance optimization)
- [ ] Conflict detection UI (nice-to-have)
- [ ] Signal strength analyzer (advanced analytics)

---

**End of Implementation Spec**

This is a detailed, actionable blueprint. Start with Part 1 (File Structure), then follow the Implementation Order in Part 9.
