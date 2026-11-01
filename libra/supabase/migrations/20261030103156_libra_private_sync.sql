-- Additive Libra sync; existing applications and auth are untouched.
create table public.libra_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check (key = 'settings' or key ~ '^book:[A-Za-z0-9_-]{1,128}$'),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<4000000),
 revision bigint not null default 1 check (revision > 0),
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (user_id,key)
);
alter table public.libra_records enable row level security;
create policy libra_owner_select on public.libra_records for select to authenticated using ((select auth.uid())=user_id);
create policy libra_owner_insert on public.libra_records for insert to authenticated with check ((select auth.uid())=user_id);
create policy libra_owner_update on public.libra_records for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.libra_records from anon,public;
grant select,insert,update on public.libra_records to authenticated;

create function public.libra_guard_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if old.deleted then raise exception 'Deleted Libra records are permanent'; end if;
  if new.user_id<>old.user_id or new.key<>old.key then raise exception 'Record identity is immutable';end if;
  if old.payload ? 'sha256' and not new.deleted and new.payload->>'sha256' is distinct from old.payload->>'sha256' then raise exception 'Book bytes are immutable';end if;
  new.revision := old.revision+1;
 else new.revision := 1;
 end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function public.libra_guard_record() from public,anon,authenticated;
create trigger libra_record_guard before insert or update on public.libra_records for each row execute function public.libra_guard_record();

create function public.libra_compare_and_set(p_key text,p_expected bigint,p_payload jsonb,p_deleted boolean default false)
returns setof public.libra_records language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_expected=0 then
  return query insert into public.libra_records(user_id,key,payload,deleted) values(auth.uid(),p_key,p_payload,p_deleted) on conflict do nothing returning *;
 else
  return query update public.libra_records set payload=p_payload,deleted=p_deleted where user_id=auth.uid() and key=p_key and revision=p_expected and not deleted returning *;
 end if;
end;$$;
revoke all on function public.libra_compare_and_set(text,bigint,jsonb,boolean) from public,anon;
grant execute on function public.libra_compare_and_set(text,bigint,jsonb,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('libra-files','libra-files',false,52428800);
create policy libra_files_read on storage.objects for select to authenticated using(bucket_id='libra-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy libra_files_insert on storage.objects for insert to authenticated with check(bucket_id='libra-files' and (storage.foldername(name))[1]=(select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9a-f]{64}$');
-- No overwrite or deletion grants: SHA-256 paths stay immutable. Tombstones retain bytes.
