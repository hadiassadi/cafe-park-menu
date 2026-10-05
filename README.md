# Cafe Park Menu - Step 3 Fixed

1. Rename `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Run `npm install`.
3. In Supabase SQL Editor, paste and run `schema.sql`.
4. Run `npm run dev` and open http://localhost:3000.
5. Create an admin user in Supabase Authentication, then use `/admin/login`.

Do not put the service role key in `.env.local`.
