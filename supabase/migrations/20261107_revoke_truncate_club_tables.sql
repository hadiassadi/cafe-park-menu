-- Remove TRUNCATE from authenticated on club tables
revoke truncate on table public.club_settings from authenticated;
revoke truncate on table public.club_settings_log from authenticated;
