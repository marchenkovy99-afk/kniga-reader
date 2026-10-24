-- Applied to the selected Trecker project; additive schema for the reader.
-- Existing application tables and authentication settings are not changed.
create table public.kniga_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-f0-9]{64}$'),
  file_name text not null check (length(file_name) between 1 and 500),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  created_at timestamptz not null default now(),
  primary key (user_id,id)
);
create table public.kniga_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  key text not null check (key = 'settings' or key ~ '^(position|appearance):(sample|[a-f0-9]{64})
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
  client_updated_at bigint not null check (client_updated_at>=0),
  primary key (user_id,device_id,key)
);
alter table public.kniga_books enable row level security;
alter table public.kniga_states enable row level security;
revoke all on public.kniga_books, public.kniga_states from anon;
grant select,insert,update,delete on public.kniga_books, public.kniga_states to authenticated;
create policy kniga_books_own on public.kniga_books for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy kniga_states_own on public.kniga_states for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into storage.buckets (id,name,public,file_size_limit)
  values ('kniga-books','kniga-books',false,20971520);
create policy kniga_files_read on storage.objects for select to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_insert on storage.objects for insert to authenticated
  with check (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_update on storage.objects for update to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_delete on storage.objects for delete to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
  client_updated_at bigint not null check (client_updated_at>=0),
  primary key (user_id,device_id,key)
);
alter table public.kniga_books enable row level security;
alter table public.kniga_states enable row level security;
revoke all on public.kniga_books, public.kniga_states from anon;
grant select,insert,update,delete on public.kniga_books, public.kniga_states to authenticated;
create policy kniga_books_own on public.kniga_books for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy kniga_states_own on public.kniga_states for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into storage.buckets (id,name,public,file_size_limit)
  values ('kniga-books','kniga-books',false,20971520);
create policy kniga_files_read on storage.objects for select to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_insert on storage.objects for insert to authenticated
  with check (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_update on storage.objects for update to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kniga_files_delete on storage.objects for delete to authenticated
  using (bucket_id='kniga-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
