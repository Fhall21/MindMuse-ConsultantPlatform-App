-- Preserve theme learning signals even after a rejected theme is removed

alter table theme_decision_logs add column if not exists theme_label text;

update theme_decision_logs as logs
set theme_label = coalesce(logs.theme_label, themes.label)
from themes
where logs.theme_id = themes.id
  and logs.theme_label is null;

update theme_decision_logs
set theme_label = 'Unknown theme'
where theme_label is null;

alter table theme_decision_logs
  alter column theme_label set not null;

alter table theme_decision_logs
  alter column theme_id drop not null;

alter table theme_decision_logs
  drop constraint if exists theme_decision_logs_theme_id_fkey;

alter table theme_decision_logs
  add constraint theme_decision_logs_theme_id_fkey
  foreign key (theme_id) references themes(id) on delete set null;

create index if not exists idx_theme_decision_logs_theme_label
  on theme_decision_logs(theme_label);
