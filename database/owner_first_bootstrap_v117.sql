-- Schmetterlinge / Badminton ONLY. First owner is verified via connected GitHub
-- authenticated login 'metzgerhannes-oss' and authorized Supabase project connection.
-- No self-claimed name/DBV ID becomes an admin; one 256-bit secret issued OUT OF BAND
-- by Supabase project administrator, in private_content only, never committed to Git.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private_content;
REVOKE ALL ON SCHEMA private_content FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS private_content.site_owners(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 verified_github_login text NOT NULL CHECK(verified_github_login='metzgerhannes-oss'),
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS private_content.owner_bootstrap(
 bootstrap_id text PRIMARY KEY CHECK(bootstrap_id='first-repository-owner'),
 token_digest bytea NOT NULL CHECK(octet_length(token_digest)=32),
 issued_for text NOT NULL CHECK(issued_for='metzgerhannes-oss'),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL CHECK(expires_at<=issued_at+interval '48 hours'),
 claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 claimed_at timestamptz,
 CONSTRAINT bootstrap_pair CHECK((claimed_by IS NULL)=(claimed_at IS NULL))
);
ALTER TABLE private_content.site_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_content.owner_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.site_owners,private_content.owner_bootstrap FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private_content FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private_content.owner_bootstrap_claim(p_token text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid(); claimed text;
BEGIN
 IF actor IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
 -- Serialize the single first-owner claim. Already claimed and expired tokens cannot be replayed.
 SELECT b.bootstrap_id INTO claimed FROM private_content.owner_bootstrap b
 WHERE b.bootstrap_id='first-repository-owner' AND b.issued_for='metzgerhannes-oss'
 AND b.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
 AND b.claimed_by IS NULL AND b.expires_at>now()
 FOR UPDATE;
 IF claimed IS NULL THEN RETURN false; END IF;
 -- Only the first activated account; cannot create a second administrator.
 IF EXISTS(SELECT 1 FROM private_content.site_owners) THEN RETURN false; END IF;
 INSERT INTO private_content.site_owners(user_id,verified_github_login)
 VALUES(actor,'metzgerhannes-oss');
 UPDATE private_content.owner_bootstrap SET claimed_by=actor,claimed_at=now()
 WHERE bootstrap_id=claimed;
 RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION private_content.owner_status()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM private_content.site_owners o WHERE o.user_id=actor AND o.revoked_at IS NULL
 ) THEN RETURN pg_catalog.jsonb_build_object('owner',false); END IF;
 RETURN pg_catalog.jsonb_build_object(
 'owner',true,
 'verified_github_login','metzgerhannes-oss',
 'granted_players',coalesce((
  SELECT pg_catalog.jsonb_agg(g.player_dbv_id ORDER BY g.player_dbv_id)
  FROM public.player_publication_grants g
  WHERE g.user_id=actor AND g.revoked_at IS NULL
 ),'[]'::jsonb)
 );
END;
$func$;

CREATE OR REPLACE FUNCTION private_content.owner_player_attest(p_player_dbv_id text,p_guardian_attestation boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_guardian_attestation IS DISTINCT FROM true
 OR p_player_dbv_id IS NULL OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
 OR NOT EXISTS (SELECT 1 FROM private_content.site_owners o
   WHERE o.user_id=actor AND o.revoked_at IS NULL)
 THEN RETURN false; END IF;
 -- Owner's explicit guardian/authorized-person assertion; never automatic from a DBV ID.
 IF NOT EXISTS(SELECT 1 FROM public.players p WHERE p.dbv_id=p_player_dbv_id) THEN RETURN false; END IF;
 -- Bound risk/size: only the repository owner, max 12 verified personal player grants.
 IF (SELECT count(*) FROM public.player_publication_grants g
     WHERE g.user_id=actor AND g.revoked_at IS NULL AND g.player_dbv_id<>p_player_dbv_id)>=12
 THEN RETURN false; END IF;
 INSERT INTO public.player_publication_grants
   (user_id,player_dbv_id,verification_method,reviewed_by,verified_at,revoked_at)
 VALUES(actor,p_player_dbv_id,'guardian_review','github-owner:metzgerhannes-oss',now(),NULL)
 ON CONFLICT(user_id,player_dbv_id) DO UPDATE SET
 verification_method='guardian_review',
 reviewed_by='github-owner:metzgerhannes-oss',verified_at=now(),revoked_at=NULL;
 RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION private_content.owner_player_revoke(p_player_dbv_id text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM private_content.site_owners o
 WHERE o.user_id=actor AND o.revoked_at IS NULL) THEN RETURN false; END IF;
 UPDATE public.player_publication_grants g SET revoked_at=now()
 WHERE g.user_id=actor AND g.player_dbv_id=p_player_dbv_id AND g.revoked_at IS NULL;
 RETURN FOUND;
END;
$func$;

CREATE OR REPLACE FUNCTION public.private_owner_bootstrap_claim(p_token text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $func$ SELECT private_content.owner_bootstrap_claim(p_token); $func$;
CREATE OR REPLACE FUNCTION public.private_owner_status()
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $func$ SELECT private_content.owner_status(); $func$;
CREATE OR REPLACE FUNCTION public.private_owner_player_attest(p_player_dbv_id text,p_guardian_attestation boolean)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $func$ SELECT private_content.owner_player_attest(p_player_dbv_id,p_guardian_attestation); $func$;
CREATE OR REPLACE FUNCTION public.private_owner_player_revoke(p_player_dbv_id text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $func$ SELECT private_content.owner_player_revoke(p_player_dbv_id); $func$;

REVOKE ALL ON FUNCTION private_content.owner_bootstrap_claim(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_content.owner_status() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_content.owner_player_attest(text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private_content.owner_player_revoke(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_owner_bootstrap_claim(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_owner_status() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_owner_player_attest(text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_owner_player_revoke(text) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private_content TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.owner_bootstrap_claim(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.owner_status() TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.owner_player_attest(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION private_content.owner_player_revoke(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_owner_bootstrap_claim(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_owner_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_owner_player_attest(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_owner_player_revoke(text) TO authenticated;
COMMIT;
