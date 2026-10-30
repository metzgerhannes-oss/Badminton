-- P0 #417: public-read rollback permanently disabled (28.10.2026).
-- Production already has verified family-only RLS and no anonymous SELECT.
-- The original emergency rollback would have restored ten publicly readable
-- sport tables and anonymous DBV identity search. It is intentionally retired.
-- This file is NOT a migration. If executed manually, it must fail closed.
-- Recovery must preserve verified member-only access; never re-open anon.
DO $p0_417_public_rollback_disabled$
BEGIN
  RAISE EXCEPTION 'P0 #417: public-read rollback disabled; preserve family-only RLS';
END
$p0_417_public_rollback_disabled$;
