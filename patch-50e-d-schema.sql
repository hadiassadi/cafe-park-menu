-- ═══════════════════════════════════════════════════════════════
-- پچ ۵۰-هـ-د — SQL یک‌بارمصرف (Supabase → SQL Editor → Run)
-- پیام‌های آمادهٔ POS در ستون jsonb جدول settings ذخیره می‌شوند.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS pos_quick_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- اطمینان از وجود ردیف settings (id = 1)
INSERT INTO settings (id, pos_quick_notes)
VALUES (1, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
