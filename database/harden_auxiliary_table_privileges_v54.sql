-- v54 / Badminton production project yadexibmjmnjfmfabrug ONLY.
-- Harden existing and future public tables against non-DML table privileges.
-- TRIGGER, REFERENCES, MAINTAIN do not need to be delegated to app clients.
-- Does not change SELECT/INSERT/UPDATE/DELETE or RLS, nor stored sport data.
begin;
revoke trigger, references, maintain on all tables in schema public
  from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke trigger, references, maintain on tables from anon, authenticated;
commit;
-- supabase_admin's separate owner defaults cannot be edited without
-- authorized membership/ownership. See #54.
