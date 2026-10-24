-- Applied to the connected Kniga Supabase project on 2026-10-24.
-- Keep existing progress intact, allow separate per-book typography records.
alter table public.kniga_states
  drop constraint kniga_states_key_check;
alter table public.kniga_states
  add constraint kniga_states_key_check
  check (key = 'settings' or key ~ '^(position|appearance):(sample|[a-f0-9]{64})$');
