-- Photo Journal — multi-user schema + Row Level Security (RLS)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Every user can only ever read/write their OWN rows and media.

-- ========== entries (one per user per date) ==========
create table if not exists public.entries (
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          text not null,                 -- 'YYYY-MM-DD'
  one_line      text default '',
  reflection    text default '',
  emotion       text,
  tags          text[] default '{}',
  memo          text default '',
  rep_asset_id  uuid,
  asset_ids     uuid[] default '{}',
  card_template text default 'poster',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (user_id, date)
);

alter table public.entries enable row level security;

drop policy if exists "entries are private to owner" on public.entries;
create policy "entries are private to owner" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========== assets (binary lives in Storage; this is metadata) ==========
create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         text not null,
  type         text not null default 'image',  -- 'image' | 'video'
  w            int,
  h            int,
  duration     real,
  storage_path text not null,                   -- '<uid>/<assetId>.<ext>'
  thumb_path   text,                            -- '<uid>/<assetId>_thumb.jpg'
  created_at   timestamptz default now()
);

alter table public.assets enable row level security;

drop policy if exists "assets are private to owner" on public.assets;
create policy "assets are private to owner" on public.assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists assets_user_date_idx on public.assets (user_id, date);

-- ========== storage bucket for photos/videos ==========
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- users may only touch files under a folder named with their own uid
drop policy if exists "media read own"   on storage.objects;
drop policy if exists "media insert own" on storage.objects;
drop policy if exists "media update own" on storage.objects;
drop policy if exists "media delete own" on storage.objects;

create policy "media read own" on storage.objects
  for select using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media insert own" on storage.objects
  for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media update own" on storage.objects
  for update using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects
  for delete using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- keep updated_at fresh on entry writes
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();
