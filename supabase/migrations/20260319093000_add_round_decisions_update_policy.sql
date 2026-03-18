do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'round_decisions'
      and policyname = 'Users can update own round_decisions'
  ) then
    create policy "Users can update own round_decisions"
      on round_decisions for update
      using (auth.uid() = user_id);
  end if;
end
$$;
