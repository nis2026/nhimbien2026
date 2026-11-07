# VIP COACH MS. NHÍM BIỂN

Web app kèm 1-1 tiếng Anh giao tiếp cho Ms. Nhím Biển cùng Mr. Leo — Khóa Starter, 25 bài.
Next.js (App Router) + TypeScript + Tailwind CSS + Zustand + Supabase (đăng nhập Google, đồng bộ tiến độ).

## Nội dung khóa học

25 bài đã được tích hợp đầy đủ trong [`src/data/units.json`](src/data/units.json).
- Từ vựng, IPA, nghĩa, câu hội thoại (Anh–Việt, từ khóa in đậm), câu phản xạ.
- IPA theo chuẩn Anh của Oxford Learner's Dictionaries.
- Game ôn tập: Ghép nghĩa, Nghe chọn từ, Thử thách từ vựng, Game câu hỏi WH & Yes/No, Flashcards.

## Video

[`src/data/videoLinks.ts`](src/data/videoLinks.ts) — video từ playlist "STARTER LION" của kênh Leo English.

## Supabase

Dùng chung project `dncwwxqzpiobooqvlurc` với Mickey / Wendy / IELTS — mọi bảng có tiền tố `nhim_bien_`.
Chạy **một lần** [`supabase/migrations/0001_nhim_bien_schema.sql`](supabase/migrations/0001_nhim_bien_schema.sql) và [`supabase/migrations/0002_admin_read_profiles.sql`](supabase/migrations/0002_admin_read_profiles.sql) trong SQL Editor,
và thêm `https://vip-coach-nhim-bien.vercel.app/auth/callback` vào Auth → URL Configuration → Redirect URLs.

## Chạy dự án

```bash
npm install
npm run dev
```
