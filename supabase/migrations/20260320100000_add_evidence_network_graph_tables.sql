-- Stage 6: Evidence network graph tables
-- canvas_connections, canvas_layout_state, graph_outbox
-- PostgreSQL-portable: standard SQL with standard PostgreSQL trigger support
-- No Supabase-specific extensions beyond uuid-ossp (already loaded)

-- ============================================================
-- canvas_connections
-- Typed directed edges between graph nodes (themes, insights,
-- people, group containers). First-class auditable entities.
-- ============================================================
create table if not exists canvas_connections (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  from_node_type text not null
    check (from_node_type in ('theme', 'insight', 'person', 'group')),
  from_node_id uuid not null,

  to_node_type text not null
    check (to_node_type in ('theme', 'insight', 'person', 'group')),
  to_node_id uuid not null,

  connection_type text not null
    check (connection_type in (
      'related_to', 'supports', 'contradicts',
      'escalates', 'resolves', 'involves'
    )),

  notes text,

  -- confidence is only meaningful for ai_suggested origins
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),

  origin text not null default 'manual'
    check (origin in ('manual', 'ai_suggested')),

  -- null = suggestion not yet reviewed; set on acceptance; row deleted on rejection
  ai_suggestion_accepted_at timestamptz,
  ai_suggestion_rationale text,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- prevent exact duplicate directed edges of the same type
  constraint canvas_connections_unique_typed_edge
    unique (round_id, from_node_type, from_node_id, to_node_type, to_node_id, connection_type)
);

alter table canvas_connections enable row level security;

create policy "Users can view own canvas_connections"
  on canvas_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own canvas_connections"
  on canvas_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own canvas_connections"
  on canvas_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own canvas_connections"
  on canvas_connections for delete
  using (auth.uid() = user_id);

create trigger set_canvas_connections_updated_at
  before update on canvas_connections
  for each row
  execute function update_updated_at_column();

create index idx_canvas_connections_round_id
  on canvas_connections(round_id);
create index idx_canvas_connections_round_user
  on canvas_connections(round_id, user_id);
create index idx_canvas_connections_from_node
  on canvas_connections(from_node_type, from_node_id);
create index idx_canvas_connections_to_node
  on canvas_connections(to_node_type, to_node_id);
create index idx_canvas_connections_origin
  on canvas_connections(round_id, origin)
  where ai_suggestion_accepted_at is null;

-- ============================================================
-- canvas_layout_state
-- Per-node position for each round × user.
-- Viewport state stored as node_type = 'viewport', node_id = round_id.
-- Layout mutations do NOT emit graph_outbox events.
-- ============================================================
create table if not exists canvas_layout_state (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  node_type text not null
    check (node_type in ('theme', 'insight', 'person', 'group', 'viewport')),
  node_id uuid not null,

  -- position for nodes; null for viewport row
  pos_x numeric(10,2),
  pos_y numeric(10,2),

  -- size for group containers; null for point nodes
  width  numeric(10,2),
  height numeric(10,2),

  -- viewport-level zoom and pan (only used when node_type = 'viewport')
  zoom  numeric(6,4),
  pan_x numeric(10,2),
  pan_y numeric(10,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint canvas_layout_state_unique_node
    unique (round_id, user_id, node_type, node_id)
);

alter table canvas_layout_state enable row level security;

create policy "Users can view own canvas_layout_state"
  on canvas_layout_state for select
  using (auth.uid() = user_id);

create policy "Users can insert own canvas_layout_state"
  on canvas_layout_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update own canvas_layout_state"
  on canvas_layout_state for update
  using (auth.uid() = user_id);

create policy "Users can delete own canvas_layout_state"
  on canvas_layout_state for delete
  using (auth.uid() = user_id);

create trigger set_canvas_layout_state_updated_at
  before update on canvas_layout_state
  for each row
  execute function update_updated_at_column();

create index idx_canvas_layout_state_round_user
  on canvas_layout_state(round_id, user_id);

-- ============================================================
-- graph_outbox
-- Append-only log of structural graph changes.
-- Written by triggers; read by the outbox relay worker.
-- Uses bigserial for stable ordering across replay.
-- No RLS: written by triggers, read only by service role.
-- ============================================================
create table if not exists graph_outbox (
  id          bigserial primary key,
  round_id    uuid not null,
  user_id     uuid not null,

  event_type text not null check (event_type in (
    'connection_added',
    'connection_updated',
    'connection_removed',
    'membership_added',
    'membership_removed',
    'group_added',
    'group_updated',
    'group_removed'
  )),

  -- which table produced the event (for replay tracing)
  source_table text not null check (source_table in (
    'canvas_connections',
    'round_theme_group_members',
    'round_theme_groups'
  )),
  source_id uuid not null,

  -- denormalised snapshot sufficient for Neo4j upsert without re-querying Postgres
  payload jsonb not null,

  -- set by outbox relay worker when enqueued to Redis
  processed_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_graph_outbox_pending
  on graph_outbox(id)
  where processed_at is null;

create index idx_graph_outbox_round
  on graph_outbox(round_id, created_at desc);

-- ============================================================
-- Trigger: canvas_connections → graph_outbox
-- ============================================================
create or replace function fn_canvas_connections_outbox()
returns trigger as $$
declare
  v_event_type text;
  v_payload    jsonb;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'connection_added';
    v_payload := jsonb_build_object(
      'connectionId',          new.id,
      'roundId',               new.round_id,
      'fromNodeType',          new.from_node_type,
      'fromNodeId',            new.from_node_id,
      'toNodeType',            new.to_node_type,
      'toNodeId',              new.to_node_id,
      'connectionType',        new.connection_type,
      'notes',                 new.notes,
      'confidence',            new.confidence,
      'origin',                new.origin,
      'aiSuggestionAcceptedAt', new.ai_suggestion_accepted_at
    );
  elsif tg_op = 'UPDATE' then
    v_event_type := 'connection_updated';
    v_payload := jsonb_build_object(
      'connectionId',          new.id,
      'roundId',               new.round_id,
      'fromNodeType',          new.from_node_type,
      'fromNodeId',            new.from_node_id,
      'toNodeType',            new.to_node_type,
      'toNodeId',              new.to_node_id,
      'connectionType',        new.connection_type,
      'notes',                 new.notes,
      'confidence',            new.confidence,
      'origin',                new.origin,
      'aiSuggestionAcceptedAt', new.ai_suggestion_accepted_at
    );
  elsif tg_op = 'DELETE' then
    v_event_type := 'connection_removed';
    v_payload := jsonb_build_object(
      'connectionId', old.id,
      'roundId',      old.round_id
    );
  end if;

  insert into graph_outbox (round_id, user_id, event_type, source_table, source_id, payload)
  values (
    coalesce(new.round_id, old.round_id),
    coalesce(new.user_id,  old.user_id),
    v_event_type,
    'canvas_connections',
    coalesce(new.id, old.id),
    v_payload
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_canvas_connections_outbox
  after insert or update or delete on canvas_connections
  for each row
  execute function fn_canvas_connections_outbox();

-- ============================================================
-- Trigger: round_theme_group_members → graph_outbox
-- Membership changes affect the implicit theme→group edge in Neo4j.
-- ============================================================
create or replace function fn_round_theme_group_members_outbox()
returns trigger as $$
declare
  v_event_type text;
  v_payload    jsonb;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'membership_added';
    v_payload := jsonb_build_object(
      'memberId',             new.id,
      'roundId',              new.round_id,
      'groupId',              new.group_id,
      'themeId',              new.theme_id,
      'sourceConsultationId', new.source_consultation_id,
      'position',             new.position
    );
  elsif tg_op = 'DELETE' then
    v_event_type := 'membership_removed';
    v_payload := jsonb_build_object(
      'memberId', old.id,
      'roundId',  old.round_id,
      'groupId',  old.group_id,
      'themeId',  old.theme_id
    );
  else
    -- UPDATE on membership is positional only; no structural graph change
    return new;
  end if;

  insert into graph_outbox (round_id, user_id, event_type, source_table, source_id, payload)
  values (
    coalesce(new.round_id, old.round_id),
    coalesce(new.user_id,  old.user_id),
    v_event_type,
    'round_theme_group_members',
    coalesce(new.id, old.id),
    v_payload
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_round_theme_group_members_outbox
  after insert or update or delete on round_theme_group_members
  for each row
  execute function fn_round_theme_group_members_outbox();

-- ============================================================
-- Trigger: round_theme_groups → graph_outbox
-- Group node creation/deletion/rename affects Neo4j group nodes.
-- ============================================================
create or replace function fn_round_theme_groups_outbox()
returns trigger as $$
declare
  v_event_type text;
  v_payload    jsonb;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'group_added';
    v_payload := jsonb_build_object(
      'groupId',  new.id,
      'roundId',  new.round_id,
      'label',    new.label,
      'status',   new.status,
      'origin',   new.origin
    );
  elsif tg_op = 'UPDATE' then
    -- only emit if structurally significant (label or status changed)
    if old.label = new.label and old.status = new.status then
      return new;
    end if;
    v_event_type := 'group_updated';
    v_payload := jsonb_build_object(
      'groupId', new.id,
      'roundId', new.round_id,
      'label',   new.label,
      'status',  new.status
    );
  elsif tg_op = 'DELETE' then
    v_event_type := 'group_removed';
    v_payload := jsonb_build_object(
      'groupId', old.id,
      'roundId', old.round_id
    );
  end if;

  insert into graph_outbox (round_id, user_id, event_type, source_table, source_id, payload)
  values (
    coalesce(new.round_id, old.round_id),
    coalesce(new.created_by, old.created_by),
    v_event_type,
    'round_theme_groups',
    coalesce(new.id, old.id),
    v_payload
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_round_theme_groups_outbox
  after insert or update or delete on round_theme_groups
  for each row
  execute function fn_round_theme_groups_outbox();
