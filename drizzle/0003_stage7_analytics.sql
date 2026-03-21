CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- Ensure trigger function exists (defined in 0000a, but included here as safeguard)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS analytics_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  round_id uuid REFERENCES consultation_rounds(id) ON DELETE SET NULL,
  phase text NOT NULL DEFAULT 'queued'
    CHECK (phase IN ('queued', 'extracting', 'embedding', 'clustering', 'syncing', 'complete', 'failed')),
  progress integer NOT NULL DEFAULT -1
    CHECK (progress >= -1 AND progress <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_jobs_active_consultation
  ON analytics_jobs(consultation_id)
  WHERE phase IN ('queued', 'extracting', 'embedding', 'clustering', 'syncing');

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_consultation_created
  ON analytics_jobs(consultation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_round_created
  ON analytics_jobs(round_id, created_at DESC);

CREATE TRIGGER set_analytics_jobs_updated_at
  BEFORE UPDATE ON analytics_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS extraction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  round_id uuid REFERENCES consultation_rounds(id) ON DELETE SET NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  extractor text NOT NULL
    CHECK (extractor IN ('langextract', 'spacy', 'combined')),
  model_version text NOT NULL,
  transcript_word_count integer NOT NULL,
  duration_ms integer NOT NULL,
  confidence numeric(4, 3) NOT NULL
    CHECK (confidence >= 0 AND confidence <= 1),
  fallback_used boolean NOT NULL DEFAULT false,
  reduced_recall boolean NOT NULL DEFAULT false,
  error_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_results_consultation_extracted
  ON extraction_results(consultation_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS idx_extraction_results_round_extracted
  ON extraction_results(round_id, extracted_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS term_extraction_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_result_id uuid NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  term text NOT NULL,
  original text,
  entity_type text NOT NULL
    CHECK (entity_type IN ('THEME', 'ISSUE', 'PERSON', 'ORG', 'LOCATION', 'DATE', 'OTHER')),
  confidence numeric(4, 3) NOT NULL
    CHECK (confidence >= 0 AND confidence <= 1),
  char_start integer NOT NULL,
  char_end integer NOT NULL,
  source_span text NOT NULL,
  extraction_source text,
  pos_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  negation_context boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_extraction_offsets_char_range_check
    CHECK (char_start >= 0 AND char_end > char_start)
);

CREATE INDEX IF NOT EXISTS idx_term_extraction_offsets_consultation_char
  ON term_extraction_offsets(consultation_id, char_start);

CREATE INDEX IF NOT EXISTS idx_term_extraction_offsets_extraction_result
  ON term_extraction_offsets(extraction_result_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS term_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  term text NOT NULL,
  entity_type text NOT NULL
    CHECK (entity_type IN ('THEME', 'ISSUE', 'PERSON', 'ORG', 'LOCATION', 'DATE', 'OTHER')),
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_embeddings_consultation_term_entity_key
    UNIQUE (consultation_id, term, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_term_embeddings_consultation_id
  ON term_embeddings(consultation_id);

CREATE INDEX IF NOT EXISTS idx_term_embeddings_embedding_cosine
  ON term_embeddings
  USING ivfflat (embedding vector_cosine_ops);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS term_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES consultation_rounds(id) ON DELETE CASCADE,
  cluster_id integer NOT NULL,
  label text NOT NULL,
  representative_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  all_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  consultation_count integer NOT NULL CHECK (consultation_count >= 0),
  clustered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_clusters_round_cluster_key UNIQUE (round_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_term_clusters_round_clustered
  ON term_clusters(round_id, clustered_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS term_cluster_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES consultation_rounds(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  term text NOT NULL,
  cluster_id integer NOT NULL,
  membership_probability numeric(4, 3) NOT NULL DEFAULT 0
    CHECK (membership_probability >= 0 AND membership_probability <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_cluster_memberships_round_consultation_term_key
    UNIQUE (round_id, consultation_id, term)
);

CREATE INDEX IF NOT EXISTS idx_term_cluster_memberships_round_cluster
  ON term_cluster_memberships(round_id, cluster_id);

CREATE INDEX IF NOT EXISTS idx_term_cluster_memberships_consultation_id
  ON term_cluster_memberships(consultation_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS analytics_outbox (
  id bigserial PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  round_id uuid REFERENCES consultation_rounds(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'consultation_projection_refresh'
    CHECK (event_type IN ('consultation_projection_refresh')),
  source_table text NOT NULL DEFAULT 'extraction_results',
  source_id uuid NOT NULL,
  payload jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_outbox_pending
  ON analytics_outbox(id)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_outbox_consultation_created
  ON analytics_outbox(consultation_id, created_at DESC);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enqueue_analytics_projection_refresh()
RETURNS trigger AS $$
DECLARE
  event_consultation_id uuid;
  event_round_id uuid;
  event_source_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    event_consultation_id := OLD.consultation_id;
    event_round_id := OLD.round_id;
    event_source_id := OLD.id;
  ELSE
    event_consultation_id := NEW.consultation_id;
    event_round_id := NEW.round_id;
    event_source_id := NEW.id;
  END IF;

  INSERT INTO analytics_outbox (
    consultation_id,
    round_id,
    event_type,
    source_table,
    source_id,
    payload
  )
  VALUES (
    event_consultation_id,
    event_round_id,
    'consultation_projection_refresh',
    'extraction_results',
    event_source_id,
    jsonb_build_object(
      'consultationId', event_consultation_id,
      'roundId', event_round_id,
      'sourceTable', 'extraction_results',
      'sourceId', event_source_id,
      'operation', TG_OP
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_extraction_results_outbox ON extraction_results;

CREATE TRIGGER trg_extraction_results_outbox
  AFTER INSERT OR UPDATE OR DELETE ON extraction_results
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_analytics_projection_refresh();
