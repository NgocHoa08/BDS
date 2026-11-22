-- =====================================================================
-- BDSNH — Bảng Cloud Save (lưu tiến trình xuyên thiết bị qua Supabase)
-- Chạy file này trong Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

create table if not exists public.bdsnh_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null default 'Đại gia BDSNH',
  state jsonb not null,
  day integer not null default 1,
  net_worth numeric not null default 1000000000,
  updated_at timestamptz not null default now()
);

alter table public.bdsnh_saves enable row level security;

-- Chỉ chính chủ tài khoản mới được xem, tạo, cập nhật và xóa file lưu của mình
drop policy if exists "Users can read own save" on public.bdsnh_saves;
create policy "Users can read own save"
  on public.bdsnh_saves
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own save" on public.bdsnh_saves;
create policy "Users can insert own save"
  on public.bdsnh_saves
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own save" on public.bdsnh_saves;
create policy "Users can update own save"
  on public.bdsnh_saves
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own save" on public.bdsnh_saves;
create policy "Users can delete own save"
  on public.bdsnh_saves
  for delete
  to authenticated
  using (auth.uid() = user_id);
