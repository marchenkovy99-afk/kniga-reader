-- Grow-only reading-time components. Each tab/session writes its own counters.
create table public.libra_reading_time (
 user_id uuid not null references auth.users(id) on delete cascade,
 book_id text not null check (book_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 replica_id text not null check (replica_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 day date not null,
 total_ms bigint not null check (total_ms between 0 and 3155760000000),
 primary key (user_id,book_id,replica_id,day)
);
alter table public.libra_reading_time enable row level security;
revoke all on public.libra_reading_time from anon;
grant select,insert,update on public.libra_reading_time to authenticated;
create policy libra_time_select on public.libra_reading_time for select to authenticated using ((select auth.uid())=user_id);
create policy libra_time_insert on public.libra_reading_time for insert to authenticated with check ((select auth.uid())=user_id);
create policy libra_time_update on public.libra_reading_time for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.libra_merge_reading_time(p_components jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_components)<>'array' or jsonb_array_length(p_components)>200 then raise exception 'Invalid component batch'; end if;
 if exists(select 1 from jsonb_array_elements(p_components) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'total_ms') is distinct from 'number' or not (x ?& array['book_id','replica_id','day','total_ms'])) then raise exception 'Invalid component'; end if;
 insert into public.libra_reading_time as current(user_id,book_id,replica_id,day,total_ms)
 select auth.uid(),x.book_id,x.replica_id,x.day,x.total_ms
 from jsonb_to_recordset(p_components) as x(book_id text,replica_id text,day date,total_ms bigint)
 on conflict (user_id,book_id,replica_id,day) do update set total_ms=greatest(current.total_ms,excluded.total_ms);
end;
$$;
revoke all on function public.libra_merge_reading_time(jsonb) from public,anon;
grant execute on function public.libra_merge_reading_time(jsonb) to authenticated;
notify pgrst,'reload schema';
