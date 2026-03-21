-- Stage 6: Evidence Network Canvas Tables
-- canvas_connections, canvas_layout_state
-- PostgreSQL-portable SQL with standard trigger support

-- ============================================================
-- canvas_connections
-- Typed directed edges between graph nodes (themes/insights).
-- First-class auditable entities.
-- ============================================================
CREATE TABLE IF NOT EXISTS canvas_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES consultation_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  from_node_type text NOT NULL CHECK (from_node_type IN ('theme', 'insight', 'person', 'group')),
  from_node_id uuid NOT NULL,

  to_node_type text NOT NULL CHECK (to_node_type IN ('theme', 'insight', 'person', 'group')),
  to_node_id uuid NOT NULL,

  connection_type text NOT NULL CHECK (connection_type IN ('causes', 'influences', 'supports', 'contradicts', 'related_to')),

  notes text,

  confidence numeric(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'ai_suggested')),

  ai_suggestion_accepted_at timestamptz,
  ai_suggestion_rationale text,

  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT canvas_connections_typed_edge_unique UNIQUE (round_id, from_node_type, from_node_id, to_node_type, to_node_id, connection_type)
);

CREATE TRIGGER set_canvas_connections_updated_at
  BEFORE UPDATE ON canvas_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_canvas_connections_round_id ON canvas_connections(round_id);
CREATE INDEX idx_canvas_connections_round_user ON canvas_connections(round_id, user_id);
CREATE INDEX idx_canvas_connections_from_node ON canvas_connections(from_node_type, from_node_id);
CREATE INDEX idx_canvas_connections_to_node ON canvas_connections(to_node_type, to_node_id);
CREATE INDEX idx_canvas_connections_origin_pending ON canvas_connections(round_id, origin);

-- ============================================================
-- canvas_layout_state
-- Per-node position for each round × user.
-- Viewport state stored as node_type = 'viewport', node_id = round_id.
-- ============================================================
CREATE TABLE IF NOT EXISTS canvas_layout_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES consultation_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  node_type text NOT NULL CHECK (node_type IN ('theme', 'insight', 'person', 'group', 'viewport')),
  node_id uuid NOT NULL,

  pos_x numeric(10, 2),
  pos_y numeric(10, 2),

  width numeric(10, 2),
  height numeric(10, 2),

  zoom numeric(6, 4),
  pan_x numeric(10, 2),
  pan_y numeric(10, 2),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT canvas_layout_state_node_unique UNIQUE (round_id, user_id, node_type, node_id)
);

CREATE TRIGGER set_canvas_layout_state_updated_at
  BEFORE UPDATE ON canvas_layout_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_canvas_layout_state_round_user ON canvas_layout_state(round_id, user_id);
