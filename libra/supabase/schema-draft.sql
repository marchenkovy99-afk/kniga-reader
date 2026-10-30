-- LIBRA isolated-cloud draft: DO NOT apply to the existing unrelated Supabase project.
-- Provision and verify a dedicated LIBRA project before any migration.
-- This file is intentionally not executed by CI or by the application.
-- API clients must use authenticated publishable keys, never service_role.

create table public.libra_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  title text not null check (char_length(title) between 1 and 1024),
  author text not null default '',
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  -- Content-addressed files are immutable; uploading a different file for the
  -- same book ID must be resolved manually before updating this reference.
  object_path text not null,
  format text not null check (format in ('fb2', 'epub', 'pdf')),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  constraint libra_own_object_path
    check (object_path = user_id::text || '/' || book_id::text || '/' || file_sha256)
);

create table public.libra_reading (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  position jsonb,
  bookmarks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(bookmarks) = 'array'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  foreign key (user_id, book_id) references public.libra_books(user_id, book_id)
);

create table public.libra_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

-- The server, not a user-device clock, assigns revisions and timestamps.
-- Clients must use update ... where revision = expected_revision and retry
-- after a conflict; a zero-row update is a conflict, not a successful write.
create function public.libra_revision_stamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 1;
  else
    NEW.revision := OLD.revision + 1;
  end if;
  NEW.updated_at := pg_catalog.now();
  return NEW;
end;
$$;

create trigger libra_books_revision
  before insert or update on public.libra_books
  for each row execute function public.libra_revision_stamp();
create trigger libra_reading_revision
  before insert or update on public.libra_reading
  for each row execute function public.libra_revision_stamp();
create trigger libra_preferences_revision
  before insert or update on public.libra_preferences
  for each row execute function public.libra_revision_stamp();

alter table public.libra_books enable row level security;
alter table public.libra_reading enable row level security;
alter table public.libra_preferences enable row level security;

-- Each owner can see and write ONLY their own rows. No public or anon access.
create policy libra_books_select on public.libra_books
 for select to authenticated using (user_id = (select auth.uid()));
create policy libra_books_insert on public.libra_books
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy libra_books_update on public.libra_books
 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));

create policy libra_reading_select on public.libra_reading
 for select to authenticated using (user_id = (select auth.uid()));
create policy libra_reading_insert on public.libra_reading
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy libra_reading_update on public.libra_reading
 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));

create policy libra_preferences_select on public.libra_preferences
 for select to authenticated using (user_id = (select auth.uid()));
create policy libra_preferences_insert on public.libra_preferences
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy libra_preferences_update on public.libra_preferences
 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));

-- Grants are necessary only when the public schema is exposed via Data API.
-- RLS still checks the authenticated user on every request.
grant select, insert, update on public.libra_books to authenticated;
grant select, insert, update on public.libra_reading to authenticated;
grant select, insert, update on public.libra_preferences to authenticated;

-- A PRIVATE bucket is mandatory: books must not have unauthenticated URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('libra-private-books', 'libra-private-books', false, 100663296);

-- Object paths are <auth.uid>/<book_id>/<sha256>.
-- Content addressed objects must never be overwritten in place.
create policy libra_storage_read on storage.objects
 for select to authenticated
 using (
  bucket_id = 'libra-private-books'
  and (storage.foldername(name))[1] = (select auth.uid())::text
 );
create policy libra_storage_upload on storage.objects
 for insert to authenticated
 with check (
  bucket_id = 'libra-private-books'
  and (storage.foldername(name))[1] = (select auth.uid())::text
 );

-- Intentionally no DELETE/UPDATE Storage policies. First release only
-- uploads new immutable objects; confirmed garbage collection needs a
-- separate reviewed, audited mechanism after tombstone retention.
