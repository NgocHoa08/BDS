-- =====================================================================
-- BDSNH — Chat Đại Gia, Bảng Tin Toàn Server & Ghé Thăm Thành Phố
-- Chạy file này trong Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- 1. Bảng Chat Đại Gia & Tin Nóng Toàn Server
create table if not exists public.bdsnh_chat (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null check (char_length(trim(player_name)) between 2 and 24),
  kind text not null default 'chat' check (kind in ('chat', 'news')),
  message text not null check (char_length(trim(message)) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists idx_bdsnh_chat_created_at
  on public.bdsnh_chat (created_at desc);

alter table public.bdsnh_chat enable row level security;

drop policy if exists "Public can read chat" on public.bdsnh_chat;
create policy "Public can read chat"
  on public.bdsnh_chat
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can insert own chat" on public.bdsnh_chat;
create policy "Authenticated can insert own chat"
  on public.bdsnh_chat
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 2. Bảng Lưu Ảnh Chụp Bản Đồ Thành Phố (Nhẹ ~5KB) Để Ghé Thăm Top 1 & BXH
create table if not exists public.bdsnh_city_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null default 'Đại gia BDSNH',
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bdsnh_city_snapshots enable row level security;

drop policy if exists "Public can read city snapshots" on public.bdsnh_city_snapshots;
create policy "Public can read city snapshots"
  on public.bdsnh_city_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert own city snapshot" on public.bdsnh_city_snapshots;
create policy "Users can insert own city snapshot"
  on public.bdsnh_city_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own city snapshot" on public.bdsnh_city_snapshots;
create policy "Users can update own city snapshot"
  on public.bdsnh_city_snapshots
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Bật Supabase Realtime cho bdsnh_chat
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bdsnh_chat'
  ) then
    alter publication supabase_realtime add table public.bdsnh_chat;
  end if;
end $$;
