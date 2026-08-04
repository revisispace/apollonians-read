-- Jalankan melalui Supabase Dashboard -> SQL Editor.
-- File buku dan audio tetap berada di perangkat; Supabase menyimpan akun,
-- metadata katalog, role, dan metrik konsumsi saja.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'superadmin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  daily_character_limit integer not null default 200000 check (daily_character_limit between 0 and 5000000),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default 'Penulis tidak diketahui',
  category text not null default 'Buku pribadi',
  duration_label text not null default '0m',
  progress smallint not null default 0 check (progress between 0 and 100),
  source_name text,
  generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  engine text not null check (engine in ('piper', 'qwen')),
  characters integer not null check (characters >= 0),
  status text not null default 'completed' check (status in ('reserved', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  qwen_enabled boolean not null default false,
  default_daily_character_limit integer not null default 200000 check (default_daily_character_limit between 0 and 5000000),
  global_daily_character_limit integer not null default 2000000 check (global_daily_character_limit between 0 and 50000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

create index if not exists books_user_created_idx on public.books (user_id, created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin' and status = 'active'
  );
$$;

revoke all on function private.is_superadmin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_superadmin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, daily_character_limit)
  values (
    new.id,
    new.email,
    coalesce((select default_daily_character_limit from public.app_settings where id = true), 200000)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

-- Membuat profil untuk akun yang sudah ada sebelum skema ini dipasang.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

create or replace function public.touch_profile()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_at = now()
  where id = (select auth.uid());
$$;

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
  qwen_is_enabled boolean;
  event_id bigint;
begin
  if caller_id is null then raise exception 'Login diperlukan'; end if;
  if requested_characters < 1 or requested_characters > 1000000 then
    raise exception 'Ukuran permintaan tidak valid';
  end if;
  if requested_engine not in ('piper', 'qwen') then raise exception 'Mesin tidak valid'; end if;
  if requested_book_id is not null and not exists (
    select 1 from public.books where id = requested_book_id and user_id = caller_id
  ) then
    raise exception 'Buku tidak ditemukan';
  end if;

  select daily_character_limit into user_limit
  from public.profiles where id = caller_id and status = 'active' for update;
  if user_limit is null then raise exception 'Akun tidak aktif'; end if;

  select global_daily_character_limit, qwen_enabled into global_limit, qwen_is_enabled
  from public.app_settings where id = true for update;
  if requested_engine = 'qwen' and not coalesce(qwen_is_enabled, false) then
    raise exception 'Qwen sedang dinonaktifkan';
  end if;

  select coalesce(sum(characters), 0) into used_by_user
  from public.usage_events
  where user_id = caller_id and status in ('reserved', 'completed')
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

create or replace function public.finish_generation(event_id bigint, succeeded boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_events
  set status = case when succeeded then 'completed' else 'failed' end
  where id = event_id and user_id = (select auth.uid()) and status = 'reserved';
$$;

-- Dipanggil manual dari SQL Editor setelah akun biasa didaftarkan.
-- Fungsi ini sengaja tidak dapat dipanggil dari browser.
create or replace function public.promote_superadmin(account_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set role = 'superadmin', status = 'active'
  where lower(email) = lower(account_email);
  if not found then raise exception 'Akun dengan email tersebut belum terdaftar'; end if;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.promote_superadmin(text) from public, anon, authenticated;
revoke all on function public.touch_profile() from public, anon;
revoke all on function public.reserve_generation(integer, text, uuid) from public, anon;
revoke all on function public.finish_generation(bigint, boolean) from public, anon;
grant execute on function public.touch_profile() to authenticated;
grant execute on function public.reserve_generation(integer, text, uuid) to authenticated;
grant execute on function public.finish_generation(bigint, boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.usage_events enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_superadmin()));

drop policy if exists "Superadmin can update profiles" on public.profiles;
create policy "Superadmin can update profiles"
  on public.profiles for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));

drop policy if exists "Users can read their books" on public.books;
create policy "Users can read their books"
  on public.books for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_superadmin()));

drop policy if exists "Users can insert their books" on public.books;
create policy "Users can insert their books"
  on public.books for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their books" on public.books;
create policy "Users can update their books"
  on public.books for update to authenticated
  using ((select auth.uid()) = user_id or (select private.is_superadmin()))
  with check ((select auth.uid()) = user_id or (select private.is_superadmin()));

drop policy if exists "Users can delete their books" on public.books;
create policy "Users can delete their books"
  on public.books for delete to authenticated
  using ((select auth.uid()) = user_id or (select private.is_superadmin()));

drop policy if exists "Users can read own usage" on public.usage_events;
create policy "Users can read own usage"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_superadmin()));

drop policy if exists "Authenticated users read app settings" on public.app_settings;
create policy "Authenticated users read app settings"
  on public.app_settings for select to authenticated using (true);

drop policy if exists "Superadmin updates app settings" on public.app_settings;
create policy "Superadmin updates app settings"
  on public.app_settings for update to authenticated
  using ((select private.is_superadmin()))
  with check ((select private.is_superadmin()));

grant select on public.profiles, public.books, public.usage_events, public.app_settings to authenticated;
grant insert, update, delete on public.books to authenticated;
grant update on public.profiles, public.app_settings to authenticated;
