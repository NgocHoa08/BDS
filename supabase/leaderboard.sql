-- =====================================================================
-- BDSNH — Bảng xếp hạng thời gian thật (Supabase PostgreSQL + Realtime)
-- Chạy toàn bộ file này trong Supabase Dashboard -> SQL Editor -> Run
-- Đừng quên bật: Authentication -> Providers -> Anonymous Sign-Ins = ON
-- =====================================================================

-- 1. Bảng lưu điểm người chơi
create table if not exists public.bdsnh_leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null check (char_length(trim(player_name)) between 2 and 24),
  net_worth numeric not null default 1000000000,
  cash numeric not null default 1000000000,
  plots_count integer not null default 0 check (plots_count >= 0 and plots_count <= 1400),
  day integer not null default 1 check (day >= 1),
  title text not null default 'Nhà đầu tư mới',
  missions_done integer not null default 0 check (missions_done >= 0 and missions_done <= 9),
  updated_at timestamptz not null default now()
);

-- 2. Chỉ mục sắp xếp Top tài sản ròng cực nhanh
create index if not exists idx_bdsnh_leaderboard_net_worth
  on public.bdsnh_leaderboard (net_worth desc, updated_at asc);

-- 3. Bật Row Level Security (RLS)
alter table public.bdsnh_leaderboard enable row level security;

-- Mọi người đều có thể xem bảng xếp hạng
drop policy if exists "Public can read leaderboard" on public.bdsnh_leaderboard;
create policy "Public can read leaderboard"
  on public.bdsnh_leaderboard
  for select
  to anon, authenticated
  using (true);

-- Người chơi chỉ được tạo dòng của chính mình
drop policy if exists "Users can insert own score" on public.bdsnh_leaderboard;
create policy "Users can insert own score"
  on public.bdsnh_leaderboard
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Người chơi chỉ được cập nhật dòng của chính mình
drop policy if exists "Users can update own score" on public.bdsnh_leaderboard;
create policy "Users can update own score"
  on public.bdsnh_leaderboard
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. RPC kiểm tra hợp lệ & chống spam cơ bản khi ghi điểm
create or replace function public.upsert_bdsnh_score(
  p_player_name text,
  p_net_worth numeric,
  p_cash numeric,
  p_plots_count integer,
  p_day integer,
  p_title text,
  p_missions_done integer
)
returns public.bdsnh_leaderboard
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_player_name, '')), 24);
  v_existing public.bdsnh_leaderboard;
  v_result public.bdsnh_leaderboard;
begin
  if v_uid is null then
    raise exception 'Chưa xác thực người chơi (bật Anonymous Sign-Ins trong Supabase Auth).';
  end if;

  if char_length(v_name) < 2 then
    v_name := 'Đại gia ' || right(replace(v_uid::text, '-', ''), 4);
  end if;

  -- Chặn giá trị phi lý (anti-cheat mức cơ bản)
  if p_net_worth < -10000000000000 or p_net_worth > 1000000000000000 then
    raise exception 'Giá trị tài sản không hợp lệ.';
  end if;

  select * into v_existing from public.bdsnh_leaderboard where user_id = v_uid;

  -- Giới hạn ghi tối thiểu mỗi 4 giây nếu không đổi tên
  if found and v_existing.player_name = v_name and now() - v_existing.updated_at < interval '4 seconds' then
    return v_existing;
  end if;

  insert into public.bdsnh_leaderboard (
    user_id, player_name, net_worth, cash, plots_count, day, title, missions_done, updated_at
  )
  values (
    v_uid,
    v_name,
    round(p_net_worth),
    round(p_cash),
    greatest(0, least(1400, p_plots_count)),
    greatest(1, p_day),
    left(trim(coalesce(p_title, 'Nhà đầu tư mới')), 40),
    greatest(0, least(9, p_missions_done)),
    now()
  )
  on conflict (user_id) do update set
    player_name   = excluded.player_name,
    net_worth     = excluded.net_worth,
    cash          = excluded.cash,
    plots_count   = excluded.plots_count,
    day           = excluded.day,
    title         = excluded.title,
    missions_done = excluded.missions_done,
    updated_at    = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.upsert_bdsnh_score(text, numeric, numeric, integer, integer, text, integer) to authenticated;

-- 5. Bật Supabase Realtime cho bảng xếp hạng
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bdsnh_leaderboard'
  ) then
    alter publication supabase_realtime add table public.bdsnh_leaderboard;
  end if;
end $$;
