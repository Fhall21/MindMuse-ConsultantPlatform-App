-- Sprint 16 / Task 02 — Canvas frames
-- Stores named curated views (node-visibility filter + viewport) over the full canvas graph.
-- Frames do not copy or move nodes; they reference node IDs from the global graph.

create table if not exists canvas_frames (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,

  -- subset of node IDs visible in this frame; empty array = show all
  node_ids jsonb not null default '[]'::jsonb,

  -- saved viewport (pan/zoom) for this frame
  viewport jsonb not null,

  -- display order within a consultation × user frame list
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table canvas_frames enable row level security;

create policy "Users can view own canvas_frames"
  on canvas_frames for select
  using (auth.uid() = user_id);

create policy "Users can insert own canvas_frames"
  on canvas_frames for insert
  with check (auth.uid() = user_id);

create policy "Users can update own canvas_frames"
  on canvas_frames for update
  using (auth.uid() = user_id);

create policy "Users can delete own canvas_frames"
  on canvas_frames for delete
  using (auth.uid() = user_id);

create trigger set_canvas_frames_updated_at
  before update on canvas_frames
  for each row
  execute function update_updated_at_column();

create index idx_canvas_frames_consultation_user
  on canvas_frames(consultation_id, user_id);

create index idx_canvas_frames_position
  on canvas_frames(consultation_id, user_id, position);
