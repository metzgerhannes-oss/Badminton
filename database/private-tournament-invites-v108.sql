-- Reproducible schema snapshot for Badminton only: yadexibmjmnjfmfabrug.
-- Already installed as migrations private_tournament_invites_v108 and
-- private_tournament_invites_rpc_hardening_v108 (2026-10-12).
-- NEVER re-apply to another project without its own access + schema audit.
-- Does not establish public DBV-player publication rights.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private_invite_internal;
CREATE TABLE IF NOT EXISTS public.private_tournament_invites(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token_digest bytea NOT NULL UNIQUE,
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 100),
 start_date date NOT NULL,
 end_date date NOT NULL,
 source_url text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CONSTRAINT private_invite_dates CHECK (end_date>=start_date AND end_date-start_date<=366),
 CONSTRAINT private_invite_expiry CHECK (expires_at<=created_at+interval '7 days 5 minutes')
);
CREATE INDEX IF NOT EXISTS private_invite_owner_quota ON public.private_tournament_invites(owner_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS private_invite_expiry_index ON public.private_tournament_invites(expires_at);
ALTER TABLE public.private_tournament_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_tournament_invites FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS private_tournament_invites_no_browser_rows ON public.private_tournament_invites;
CREATE POLICY private_tournament_invites_no_browser_rows ON public.private_tournament_invites
 AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
-- SECURITY DEFINER routines live in a separate unexposed schema.
REVOKE ALL ON SCHEMA private_invite_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private_invite_internal TO anon,authenticated;

CREATE OR REPLACE FUNCTION private_invite_internal.private_tournament_invite_create(p_token text, p_title text, p_start_date date, p_end_date date, p_source_url text)
 RETURNS TABLE(invitation_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 owner_id uuid := auth.uid();
 n_title text := btrim(p_title);
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authenticated creator required' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation token' USING ERRCODE='22023';
 END IF;
 IF n_title IS NULL OR char_length(n_title) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid event title' USING ERRCODE='22023';
 END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date
   OR p_end_date-p_start_date>366 THEN
  RAISE EXCEPTION 'Invalid date interval' USING ERRCODE='22023';
 END IF;
 IF p_source_url IS NULL OR NOT (
   p_source_url='https://turniere.badminton.de/'
   OR p_source_url ~ '^https://dbv[.]turnier[.]de/tournament/[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$'
 ) THEN RAISE EXCEPTION 'Unsupported event source' USING ERRCODE='22023'; END IF;
 -- Serialize each owner's creations so burst requests cannot race the quotas.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,108));
 IF (SELECT count(*) FROM public.private_tournament_invites
     WHERE owner_user_id=owner_id AND created_at>now()-interval '24 hours')>=12
 THEN RAISE EXCEPTION 'Daily invitation limit reached' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.private_tournament_invites
     WHERE owner_user_id=owner_id AND revoked_at IS NULL AND expires_at>now())>=8
 THEN RAISE EXCEPTION 'Too many active invitations' USING ERRCODE='22023'; END IF;
 RETURN QUERY INSERT INTO public.private_tournament_invites
   (owner_user_id,token_digest,title,start_date,end_date,source_url,expires_at)
 VALUES(owner_id,extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256'),
        n_title,p_start_date,p_end_date,p_source_url,now()+interval '7 days')
 RETURNING id, public.private_tournament_invites.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION private_invite_internal.private_tournament_invite_read(p_token text)
 RETURNS TABLE(title text, start_date date, end_date date, source_url text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;
 RETURN QUERY
 SELECT i.title,i.start_date,i.end_date,i.source_url,i.expires_at
 FROM public.private_tournament_invites i
 WHERE i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
  AND i.revoked_at IS NULL AND i.expires_at>now()
 LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION private_invite_internal.private_tournament_invite_revoke(p_invitation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated owner required' USING ERRCODE='42501'; END IF;
 UPDATE public.private_tournament_invites i SET revoked_at=now()
 WHERE i.id=p_invitation_id AND i.owner_user_id=auth.uid()
  AND i.revoked_at IS NULL AND i.expires_at>now();
 RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.private_tournament_invite_create(p_token text, p_title text, p_start_date date, p_end_date date, p_source_url text)
 RETURNS TABLE(invitation_id uuid, expires_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT * FROM private_invite_internal.private_tournament_invite_create(
  p_token,p_title,p_start_date,p_end_date,p_source_url);
$function$;

CREATE OR REPLACE FUNCTION public.private_tournament_invite_read(p_token text)
 RETURNS TABLE(title text, start_date date, end_date date, source_url text, expires_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT * FROM private_invite_internal.private_tournament_invite_read(p_token);
$function$;

CREATE OR REPLACE FUNCTION public.private_tournament_invite_revoke(p_invitation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT private_invite_internal.private_tournament_invite_revoke(p_invitation_id);
$function$;
-- Direct-table reads/writes remain impossible for both browser roles.
-- Only caller-specific RPC capabilities are accessible from the Data API.
REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_create(text,text,date,date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_read(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_revoke(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_tournament_invite_create(text,text,date,date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_tournament_invite_read(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_tournament_invite_revoke(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_read(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_read(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_create(text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_create(text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_revoke(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_revoke(uuid) TO authenticated;
COMMIT;
