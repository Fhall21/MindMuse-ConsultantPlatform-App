`term_embeddings` migration contract for Agent 4

```sql
CREATE TABLE term_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_term_embeddings_embedding_cosine
    ON term_embeddings
    USING ivfflat (embedding vector_cosine_ops);
```

Notes:
- `consultation_id` must cascade-delete for compliance and round recomputation.
- `term` stores the canonical string returned by `embed_terms()`.
- `cluster_round()` expects `consultations.round_id` joins against this table.
