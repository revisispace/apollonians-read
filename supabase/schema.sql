-- Jalankan sekali melalui Supabase Dashboard → SQL Editor.
-- File buku dan audio tidak masuk ke Supabase; hanya metadata yang disinkronkan.

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

create index if not exists books_user_created_idx
  on public.books (user_id, created_at desc);

alter table public.books enable row level security;

drop policy if exists "Users can read their books" on public.books;
create policy "Users can read their books"
  on public.books for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their books" on public.books;
create policy "Users can insert their books"
  on public.books for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their books" on public.books;
create policy "Users can update their books"
  on public.books for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their books" on public.books;
create policy "Users can delete their books"
  on public.books for delete
  to authenticated
  using ((select auth.uid()) = user_id);
