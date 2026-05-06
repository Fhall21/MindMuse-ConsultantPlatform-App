-- Sprint 16 / Task 02 follow-up: make canvas frame storage available to Drizzle-managed DBs.
-- Supabase migration already exists; this keeps local/app migrations in sync.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS canvas_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  node_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  viewport jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE canvas_frames DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'canvas_frames'
      AND con.contype = 'f'
      AND att.attname = 'user_id'
      AND con.confrelid <> 'public.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE canvas_frames DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'canvas_frames'::regclass
      AND contype = 'f'
      AND conname = 'canvas_frames_user_id_users_id_fk'
  ) THEN
    ALTER TABLE canvas_frames
      ADD CONSTRAINT canvas_frames_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_canvas_frames_updated_at'
      AND tgrelid = 'canvas_frames'::regclass
  ) THEN
    CREATE TRIGGER set_canvas_frames_updated_at
      BEFORE UPDATE ON canvas_frames
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_canvas_frames_consultation_user
  ON canvas_frames(consultation_id, user_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_canvas_frames_position
  ON canvas_frames(consultation_id, user_id, position);
