do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pending_pokes'
  ) then
    alter publication supabase_realtime add table public.pending_pokes;
  end if;
end;
$$;
