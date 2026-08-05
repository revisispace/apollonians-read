-- Migrasi Qwen -> Edge TTS untuk database Apollonians Read yang sudah berjalan.
-- Jalankan sekali melalui Supabase Dashboard -> SQL Editor sebelum mengaktifkan Edge TTS.

begin;

-- Pertahankan histori pemakaian lama, tetapi gunakan nama engine produk saat ini.
update public.usage_events set engine = 'edge' where engine = 'qwen';

alter table public.usage_events drop constraint if exists usage_events_engine_check;
alter table public.usage_events
  add constraint usage_events_engine_check check (engine in ('piper', 'edge'));

alter table public.app_settings
  add column if not exists edge_tts_enabled boolean not null default true;

update public.app_settings
set edge_tts_enabled = coalesce(qwen_enabled, true)
where id = true;

alter table public.app_settings drop column if exists qwen_enabled;

create or replace function public.reserve_generation(
  requested_characters integer,
  requested_engine text,
  requested_book_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  user_limit integer;
  global_limit integer;
  used_by_user bigint;
  used_globally bigint;
  edge_is_enabled boolean;
  event_id bigint;
begin
  if caller_id is null then raise exception 'Login diperlukan'; end if;
  if requested_characters < 1 or requested_characters > 1000000 then
    raise exception 'Ukuran permintaan tidak valid';
  end if;
  if requested_engine not in ('piper', 'edge') then
    raise exception 'Mesin tidak valid';
  end if;
  if requested_book_id is not null and not exists (
    select 1 from public.books where id = requested_book_id and user_id = caller_id
  ) then
    raise exception 'Buku tidak ditemukan';
  end if;

  select daily_character_limit into user_limit
  from public.profiles
  where id = caller_id and status = 'active'
  for update;
  if user_limit is null then raise exception 'Akun tidak aktif'; end if;

  select global_daily_character_limit, edge_tts_enabled
  into global_limit, edge_is_enabled
  from public.app_settings
  where id = true
  for update;

  if requested_engine = 'edge' and not coalesce(edge_is_enabled, false) then
    raise exception 'Edge TTS sedang dinonaktifkan';
  end if;

  select coalesce(sum(characters), 0) into used_by_user
  from public.usage_events
  where user_id = caller_id
    and status in ('reserved', 'completed')
    and created_at >= date_trunc('day', now());

  select coalesce(sum(characters), 0) into used_globally
  from public.usage_events
  where status in ('reserved', 'completed')
    and created_at >= date_trunc('day', now());

  if used_by_user + requested_characters > user_limit then
    raise exception 'Kuota karakter harian akun habis';
  end if;
  if used_globally + requested_characters > global_limit then
    raise exception 'Batas penggunaan aplikasi hari ini tercapai';
  end if;

  insert into public.usage_events (user_id, book_id, engine, characters, status)
  values (caller_id, requested_book_id, requested_engine, requested_characters, 'reserved')
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.reserve_generation(integer, text, uuid) from public, anon;
grant execute on function public.reserve_generation(integer, text, uuid) to authenticated;

create or replace function public.get_quota_info()
returns table (daily_limit integer, used_today bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.daily_character_limit,
    coalesce(sum(u.characters) filter (
      where u.status in ('reserved', 'completed')
        and u.created_at >= date_trunc('day', now())
    ), 0)::bigint
  from public.profiles p
  left join public.usage_events u on u.user_id = p.id
  where p.id = (select auth.uid())
  group by p.daily_character_limit;
$$;

revoke all on function public.get_quota_info() from public, anon;
grant execute on function public.get_quota_info() to authenticated;

commit;
