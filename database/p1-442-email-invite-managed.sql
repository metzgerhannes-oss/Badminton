-- P1 #442: owner-managed, revocable email allowlist. Never expose recipient emails.
-- Existing Cloudflare family members remain unmanaged and cannot be revoked by this RPC.
BEGIN;
CREATE TABLE IF NOT EXISTS private_content.cf_access_invite_managed (
 email_sha256 bytea PRIMARY KEY,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_issued_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 CONSTRAINT cf_access_invite_managed_hash CHECK (octet_length(email_sha256)=32)
);
ALTER TABLE private_content.cf_access_invite_managed ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.cf_access_invite_managed FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.cf_access_email_invite_manage(p_email text,p_action text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $func$
DECLARE v_email text; v_hash bytea; v_managed private_content.cf_access_invite_managed%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM private_content.site_owners o
   WHERE o.user_id=auth.uid() AND o.revoked_at IS NULL
 ) THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501'; END IF;
 v_email:=pg_catalog.lower(pg_catalog.btrim(p_email));
 IF v_email IS NULL OR length(v_email)<6 OR length(v_email)>254
    OR v_email !~ '^[a-z0-9.!#$%&''*+/=?^`{|}~-]+@[a-z0-9-]+([.][a-z0-9-]+)+$'
 THEN RETURN 'invalid_email'; END IF;
 v_hash:=extensions.digest(pg_catalog.convert_to(v_email,'UTF8'),'sha256');
 SELECT * INTO v_managed FROM private_content.cf_access_invite_managed
  WHERE email_sha256=v_hash FOR UPDATE;
 IF p_action='enable' THEN
   IF v_managed.email_sha256 IS NOT NULL AND v_managed.revoked_at IS NULL
     THEN RETURN 'existing'; END IF;
   IF v_managed.email_sha256 IS NULL AND EXISTS(
     SELECT 1 FROM private_content.cf_access_allowed_emails
     WHERE email_sha256=v_hash AND enabled
   ) THEN RETURN 'baseline'; END IF;
   IF (SELECT count(*) FROM private_content.cf_access_invite_managed
       WHERE invited_by=auth.uid() AND last_issued_at>now()-interval '24 hours')>=15
   THEN RETURN 'rate_limited'; END IF;
   INSERT INTO private_content.cf_access_invite_managed(email_sha256,invited_by,last_issued_at,revoked_at)
   VALUES(v_hash,auth.uid(),now(),NULL)
   ON CONFLICT(email_sha256) DO UPDATE
   SET revoked_at=NULL,last_issued_at=now(),invited_by=EXCLUDED.invited_by;
   INSERT INTO private_content.cf_access_allowed_emails(email_sha256,enabled,approved_at)
   VALUES(v_hash,true,now()) ON CONFLICT(email_sha256) DO UPDATE
   SET enabled=true,approved_at=now();
   RETURN 'new';
 ELSIF p_action='disable' THEN
   IF v_managed.email_sha256 IS NULL THEN RETURN 'unmanaged'; END IF;
   UPDATE private_content.cf_access_invite_managed SET revoked_at=now()
    WHERE email_sha256=v_hash;
   UPDATE private_content.cf_access_allowed_emails SET enabled=false
    WHERE email_sha256=v_hash;
   RETURN 'revoked';
 ELSIF p_action='check' THEN
   IF v_managed.email_sha256 IS NULL THEN RETURN 'unmanaged'; END IF;
   RETURN CASE WHEN v_managed.revoked_at IS NULL THEN 'active' ELSE 'revoked' END;
 END IF;
 RETURN 'invalid_action';
END
$func$;
REVOKE ALL ON FUNCTION public.cf_access_email_invite_manage(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_access_email_invite_manage(text,text) TO authenticated;
COMMIT;
