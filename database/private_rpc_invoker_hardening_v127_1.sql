-- v127.1: move privileged player/trophy operations into the unexposed private schema.
-- Public RPC entrypoints are SECURITY INVOKER only. Auth/session/individual scope
-- checks are unchanged. No private data or new rights are exposed.
BEGIN;
CREATE OR REPLACE FUNCTION private_content.owner_trophies_read_impl(p_player_dbv_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR p_player_dbv_id IS NULL
  OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
  OR NOT private_content.has_independent_player_grant(auth.uid(),p_player_dbv_id)
 THEN RETURN NULL; END IF;
 RETURN private_content.scoped_trophy_projection(p_player_dbv_id);
END
$fn$;
CREATE OR REPLACE FUNCTION private_content.player_trophies_read_impl(p_invitation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE target_id text;
BEGIN
 IF auth.uid() IS NULL OR p_invitation_id IS NULL THEN RETURN NULL; END IF;
 SELECT i.player_dbv_id INTO target_id
 FROM private_content.player_access_invites i
 WHERE i.id=p_invitation_id AND i.accepted_by=auth.uid()
  AND i.accepted_at IS NOT NULL AND i.revoked_at IS NULL
  AND i.scope_version=2 AND i.granted_sections@>ARRAY['trophies']::text[]
  AND private_content.has_independent_player_grant(i.owner_user_id,i.player_dbv_id)
 LIMIT 1;
 IF target_id IS NULL THEN RETURN NULL; END IF;
 RETURN private_content.scoped_trophy_projection(target_id);
END
$fn$;
REVOKE ALL ON FUNCTION private_content.owner_trophies_read_impl(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_content.player_trophies_read_impl(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private_content.owner_trophies_read_impl(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.player_trophies_read_impl(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.private_owner_trophies_read(p_player_dbv_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $fn$ SELECT private_content.owner_trophies_read_impl(p_player_dbv_id) $fn$;
CREATE OR REPLACE FUNCTION public.private_player_trophies_read(p_invitation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $fn$ SELECT private_content.player_trophies_read_impl(p_invitation_id) $fn$;

-- The three simple public JSON/UUID wrappers already delegate to protected
-- private_content SECURITY DEFINER functions. Grant only narrow EXECUTE there.
GRANT EXECUTE ON FUNCTION private_content.player_management_request_create(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.player_management_request_status() TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.player_management_review_decide(uuid,boolean,text) TO authenticated;
ALTER FUNCTION public.private_player_manage_request(text,text) SECURITY INVOKER;
ALTER FUNCTION public.private_player_manage_status() SECURITY INVOKER;
ALTER FUNCTION public.private_player_manage_review(uuid,boolean,text) SECURITY INVOKER;
ALTER FUNCTION public.private_player_scope_capabilities() SECURITY INVOKER;

-- Explicitly leave direct anonymous execution disabled for every public read
-- and modification RPC.
REVOKE ALL ON FUNCTION public.private_owner_trophies_read(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.private_player_trophies_read(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.private_player_manage_request(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.private_player_manage_status() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.private_player_manage_review(uuid,boolean,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.private_player_scope_capabilities() FROM PUBLIC,anon;
COMMIT;
