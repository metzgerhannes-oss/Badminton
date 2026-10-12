-- v108 follow-up: keep the privileged implementations out of all PostgREST exposed schemas.
-- Public functions are SECURITY INVOKER wrappers; every capability remains token-/owner-scoped.
CREATE SCHEMA IF NOT EXISTS private_invite_internal;
REVOKE ALL ON SCHEMA private_invite_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private_invite_internal TO anon,authenticated;

ALTER FUNCTION public.private_tournament_invite_create(text,text,date,date,text)
 SET SCHEMA private_invite_internal;
ALTER FUNCTION public.private_tournament_invite_read(text)
 SET SCHEMA private_invite_internal;
ALTER FUNCTION public.private_tournament_invite_revoke(uuid)
 SET SCHEMA private_invite_internal;

REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_create(text,text,date,date,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_read(text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_invite_internal.private_tournament_invite_revoke(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_create(text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_revoke(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private_invite_internal.private_tournament_invite_read(text) TO anon,authenticated;

-- These wrappers do not bypass row permissions or carry elevated rights themselves.
CREATE FUNCTION public.private_tournament_invite_create(
 p_token text,p_title text,p_start_date date,p_end_date date,p_source_url text)
RETURNS TABLE(invitation_id uuid,expires_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
 SELECT * FROM private_invite_internal.private_tournament_invite_create(
  p_token,p_title,p_start_date,p_end_date,p_source_url);
$function$;
CREATE FUNCTION public.private_tournament_invite_read(p_token text)
RETURNS TABLE(title text,start_date date,end_date date,source_url text,expires_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
 SELECT * FROM private_invite_internal.private_tournament_invite_read(p_token);
$function$;
CREATE FUNCTION public.private_tournament_invite_revoke(p_invitation_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
 SELECT private_invite_internal.private_tournament_invite_revoke(p_invitation_id);
$function$;
REVOKE ALL ON FUNCTION public.private_tournament_invite_create(text,text,date,date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_tournament_invite_read(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_tournament_invite_revoke(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_create(text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_revoke(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_tournament_invite_read(text) TO anon,authenticated;

-- RLS is also explicitly deny-by-default. Neither anon nor authenticated has direct table privileges.
CREATE POLICY private_tournament_invites_no_browser_rows
 ON public.private_tournament_invites AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING (false) WITH CHECK (false);
