-- #414 private automatic import bootstrap. No secrets in source control.
-- For the explicitly approved *family-only* official weekly XLSX export.
-- Does not publish/merge the app, authorize match-history APIs or expose RLS.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Random high-entropy key never leaves the database/Vault.
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='private_dbv_weekly_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'private_dbv_weekly_token','Private DBV family weekly cron token');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='private_dbv_weekly_url') THEN
    PERFORM vault.create_secret(
      'https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/private-dbv-weekly',
      'private_dbv_weekly_url','Private DBV family weekly function URL');
  END IF;
END
$bootstrap$;

-- This RPC is available only to the server's service role.
-- The Edge function validates the secret BEFORE any source request, lease or
-- importer write. An anonymous caller cannot invoke this RPC.
CREATE OR REPLACE FUNCTION public.authorize_private_dbv_weekly(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $auth$
DECLARE v_secret text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private_content.dbv_weekly_state WHERE id=1 AND enabled
  ) THEN RETURN false; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name='private_dbv_weekly_token';
  IF v_secret IS NULL OR length(v_secret)<>64 THEN RETURN false; END IF;
  RETURN extensions.digest(pg_catalog.convert_to(p_token,'UTF8'),'sha256') =
         extensions.digest(pg_catalog.convert_to(v_secret,'UTF8'),'sha256');
END
$auth$;
REVOKE ALL ON FUNCTION public.authorize_private_dbv_weekly(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_private_dbv_weekly(text) TO service_role;

-- A single daily lightweight check catches any newly published official
-- weekly snapshot. The importer downloads XLSX only on a new verified week.
-- Cron is inert until the private DB state is explicitly enabled.
SELECT cron.schedule(
  'badminton-private-dbv-weekly-daily-v2',
  '15 12 * * *',
  $$SELECT private_content.dispatch_private_dbv_weekly();$$
);
