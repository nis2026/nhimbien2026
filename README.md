# VIP COACH MS. NHÍM BIỂN

Web app kèm 1-1 tiếng Anh giao tiếp cho Ms. Nhím Biển cùng Mr. Leo — Khóa Starter, 25 bài.
Next.js (App Router) + TypeScript + Tailwind CSS + Zustand + Supabase (đăng nhập Google, đồng bộ tiến độ).

## Nội dung khóa học

25 bài lấy từ các thư mục `../UNIT 1 Introducing Yourself` … `../UNIT 25 At the Party`, gộp vào
[`src/data/units.json`](src/data/units.json) bằng:

```bash
npm run parse:units   # cần: pip install python-docx
```

- File `… FULL.html` của mỗi bài → từ vựng, IPA, nghĩa, câu hội thoại (Anh–Việt, từ khóa in đậm), câu phản xạ.
- File Word chính `Unit N ….docx` → tên bài Anh/Việt, từ loại, tên nhân vật trong hội thoại.
  (File `Unit 6 dialogue.html` trong nguồn là bản sao nhầm của Unit 5 nên không dùng.)
- Câu ví dụ của mỗi từ = câu phản xạ chứa từ đó (hoặc câu hội thoại / câu trả lời Q&A nếu không có).
- IPA theo chuẩn Anh của Oxford Learner's Dictionaries: [`scripts/oxford_ipa_map.json`](scripts/oxford_ipa_map.json).

## Video

[`src/data/videoLinks.ts`](src/data/videoLinks.ts) — 8 video từ playlist "STARTER LION" của kênh Leo English,
khớp theo tên bài (số UNIT trên video là số trong khóa Starter đầy đủ, khác số bài trong app).
Ảnh bìa `public/units/unit-01..08.jpg` là thumbnail của chính các video đó.

## Supabase

Dùng chung project `dncwwxqzpiobooqvlurc` với Mickey / Wendy / IELTS — mọi bảng có tiền tố `miu_`.
Chạy **một lần** [`supabase/migrations/0001_miu_schema.sql`](supabase/migrations/0001_miu_schema.sql) trong SQL Editor,
và thêm `https://vip-coach-miu.vercel.app/auth/callback` vào Auth → URL Configuration → Redirect URLs.

## Chạy dự án

```bash
npm install
npm run dev
```
