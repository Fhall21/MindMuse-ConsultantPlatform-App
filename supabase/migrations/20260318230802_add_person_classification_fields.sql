alter table people
  add column if not exists working_group text,
  add column if not exists work_type text;
