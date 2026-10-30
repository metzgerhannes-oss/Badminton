-- P0 #417 · Additive, no-downtime owner-device transfer protocol.
-- NO client can mint recovery codes. Operator must issue a short-lived
-- random authorization in private_content.owner_device_handover separately.
-- The old owner continues to work until the new owner is verified and
-- a separate explicit deactivation is approved.
BEGIN;
CREATE TABLE IF NOT EXISTS private_content.owner_device_handover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_owner uuid NOT NULL REFERENCES auth.users(id),
  secret_digest bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_by uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  CONSTRAINT p0_417_owner_transfer_digest_size CHECK (octet_length(secret_digest)=32),
  CONSTRAINT p0_417_owner_transfer_expiry CHECK (expires_at>created_at)
);
ALTER TABLE private_content.owner_device_handover ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.owner_device_handover FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.app_owner_device_transfer_claim(
  p_invitation_secret text, p_transfer_secret text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $handover$
DECLARE
  actor uuid := auth.uid();
  handover_id uuid;
  original_owner uuid;
  original_login text;
  valid_invitation uuid;
BEGIN
  -- The anonymous Supabase Auth user is authenticated but never a member by
  -- mere role or device possession. Both independent 256-bit tokens are needed.
  IF actor IS NULL
    OR p_invitation_secret IS NULL OR p_invitation_secret !~ '^[a-f0-9]{64}$'
    OR p_transfer_secret IS NULL OR p_transfer_secret !~ '^[a-f0-9]{64}$'
  THEN RETURN false; END IF;
  SELECT h.id,h.source_owner,o.verified_github_login
    INTO handover_id,original_owner,original_login
  FROM private_content.owner_device_handover h
  JOIN private_content.site_owners o ON o.user_id=h.source_owner
  WHERE h.secret_digest=extensions.digest(pg_catalog.decode(p_transfer_secret,'hex'),'sha256')
    AND h.claimed_by IS NULL AND h.claimed_at IS NULL
    AND h.expires_at>now() AND o.revoked_at IS NULL
  FOR UPDATE OF h;
  IF handover_id IS NULL OR actor=original_owner THEN RETURN false; END IF;
  -- An arbitrary existing family membership does not prove that the visitor
  -- owns the account being moved. The exact currently redeemable invitation
  -- must be signed by that original owner and accepted by the new session.
  SELECT i.id INTO valid_invitation
  FROM private_content.app_access_invites i
  JOIN private_content.app_access_members m
    ON m.invitation_id=i.id AND m.user_id=actor
  WHERE i.issuer=original_owner
    AND i.secret_digest=extensions.digest(pg_catalog.decode(p_invitation_secret,'hex'),'sha256')
    AND i.revoked_at IS NULL AND i.redeem_until>now();
  IF valid_invitation IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM private_content.site_owners WHERE user_id=actor)
  THEN RETURN false; END IF;
  INSERT INTO private_content.site_owners(user_id,verified_github_login)
    VALUES(actor,original_login);
  -- Preserve the existing verified guardian/player publication grants in both
  -- origins for the cutover. These are copied, not modified or revoked.
  INSERT INTO public.player_publication_grants(
    user_id,player_dbv_id,verification_method,reviewed_by,verified_at,revoked_at)
  SELECT actor,player_dbv_id,verification_method,reviewed_by,verified_at,revoked_at
  FROM public.player_publication_grants WHERE user_id=original_owner
  ON CONFLICT (user_id,player_dbv_id) DO NOTHING;
  UPDATE private_content.owner_device_handover
    SET claimed_by=actor,claimed_at=now() WHERE id=handover_id;
  RETURN true;
END
$handover$;
REVOKE ALL ON FUNCTION public.app_owner_device_transfer_claim(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_owner_device_transfer_claim(text,text) TO authenticated;
COMMIT;
