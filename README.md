# BDSNH — Game Mô Phỏng Bất Động Sản

Game mô phỏng kinh doanh & đầu tư bất động sản 2.5D Isometric thời gian thật với đồ hoạ HD/Ultra (60+ FPS) và **Bảng xếp hạng trực tuyến (Supabase Realtime)**.

## Tính năng chính
- **Bản đồ Isometric 2.5D (1.400 lô đất)**: 4 khu vực trong nước (Thành phố, Vùng quê, Vùng biển, Vùng núi) + 4 thị trường láng giềng qua Sông Mê Kông (Trung Quốc, Lào, Thái Lan, Campuchia), 6 công trình biểu tượng & Dinh Độc Lập.
- **41 loại công trình & 3 cấp nâng cấp**: Cho thuê, kinh doanh tự động, gọi vốn hợp tác 70/30, ngân hàng (tiết kiệm 5%/năm, vay 9%/năm), thuế 30 ngày, đấu giá UBND, thương lượng NPC, chiến dịch marketing & Lễ hội Tết.
- **Đồ hoạ HD/Ultra & tối ưu 60+ FPS**: World-space HiDPI chunk cache, giao thông & tàu thuyền sống động, ánh sáng 24h & đèn đêm, 4 mức tuỳ chỉnh đồ hoạ + bộ đếm FPS trực tiếp.
- **Bảng xếp hạng Realtime (Supabase)**: Top 50 theo tài sản ròng, trạng thái người chơi đang online (Presence), Anonymous Auth + Row Level Security.

## Chạy trên máy cá nhân
```bash
npm install
cp .env.example .env
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env
npm run dev
```

## Cấu hình Supabase Realtime Leaderboard
1. Chạy file `supabase/leaderboard.sql` trong **Supabase SQL Editor**.
2. Bật **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
3. Khai báo `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` khi deploy lên Vercel / Netlify / Cloudflare Pages.
