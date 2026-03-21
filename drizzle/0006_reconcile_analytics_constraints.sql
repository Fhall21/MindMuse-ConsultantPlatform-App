-- Reconcile analytics constraint drift after the consultation→meeting rename.
--
-- Some local databases were partially updated to the new column layout without
-- also receiving the current unique/index contract that the app and AI worker
-- now rely on. This migration restores the meeting-based uniqueness and lookup
-- indexes without assuming a perfectly clean starting point.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_jobs'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_jobs_meeting_created ON analytics_jobs(meeting_id, created_at DESC)';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_cluster_memberships'
      AND column_name = 'round_id'
  ) THEN
    EXECUTE 'ALTER TABLE term_cluster_memberships ALTER COLUMN round_id DROP NOT NULL';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'extraction_results'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_extraction_results_meeting_extracted ON extraction_results(meeting_id, extracted_at DESC)';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_extraction_offsets'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_extraction_offsets_meeting_char ON term_extraction_offsets(meeting_id, char_start)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_extraction_offsets_extraction_result ON term_extraction_offsets(extraction_result_id)';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_embeddings'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_embeddings_meeting_id ON term_embeddings(meeting_id)';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS term_embeddings_meeting_term_entity_key ON term_embeddings(meeting_id, term, entity_type)';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_clusters'
      AND column_name = 'consultation_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS term_clusters_consultation_cluster_key ON term_clusters(consultation_id, cluster_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_clusters_consultation_clustered ON term_clusters(consultation_id, clustered_at DESC)';
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_cluster_memberships'
      AND column_name = 'consultation_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'term_cluster_memberships'
      AND column_name = 'meeting_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS term_cluster_memberships_consultation_meeting_term_key ON term_cluster_memberships(consultation_id, meeting_id, term)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_cluster_memberships_consultation_cluster ON term_cluster_memberships(consultation_id, cluster_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_term_cluster_memberships_meeting_id ON term_cluster_memberships(meeting_id)';
  END IF;
END
$$;