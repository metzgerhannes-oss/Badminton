"""No stored service-role secret; only the authorised main workflow can request sync."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("oidc",ROOT/"scripts"/"publish-dbv-calendar-oidc.py")
oidc=importlib.util.module_from_spec(spec)
spec.loader.exec_module(oidc)

class OIDCContractTests(unittest.TestCase):
 def test_rejects_other_repositories_and_branches_before_network(self):
  env={
   "GITHUB_REPOSITORY":"metzgerhannes-oss/Other",
   "GITHUB_REF":"refs/heads/main",
   "ACTIONS_ID_TOKEN_REQUEST_URL":"https://token.actions.githubusercontent.com/?x=1",
   "ACTIONS_ID_TOKEN_REQUEST_TOKEN":"dummy"
  }
  with self.assertRaisesRegex(RuntimeError,"Only the repository"):
   oidc.request_oidc_token(env)
  env["GITHUB_REPOSITORY"]=oidc.REPOSITORY
  env["GITHUB_REF"]="refs/pull/129/merge"
  with self.assertRaisesRegex(RuntimeError,"Only the repository"):
   oidc.request_oidc_token(env)
 def test_missing_token_fails_closed(self):
  with self.assertRaisesRegex(RuntimeError,"Missing GitHub OIDC"):
   oidc.request_oidc_token({"GITHUB_REPOSITORY":oidc.REPOSITORY,"GITHUB_REF":"refs/heads/main"})
 def test_url_and_payload_never_target_personal_data(self):
  self.assertEqual(oidc.AUDIENCE,"schmetterlinge-dbv-calendar-yadexibmjmnjfmfabrug")
  self.assertIn("/functions/v1/dbv-calendar-publish",oidc.FUNCTION)
  workflow=(ROOT/".github/workflows/dbv-calendar-source.yml").read_text()
  self.assertIn("id-token: write",workflow)
  self.assertNotIn("secrets.BADMINTON_SUPABASE_SERVICE_ROLE_KEY",workflow)
  self.assertIn("scripts/publish-dbv-calendar-oidc.py",workflow)
  source=(ROOT/"supabase/functions/dbv-calendar-publish/index.ts").read_text()
  self.assertIn("jwtVerify(",source)
  self.assertIn("payload.repository_id",source)
  self.assertIn("payload.workflow_ref===WORKFLOW",source)
  self.assertIn("repo:metzgerhannes-oss@326005713/Badminton@1412033492:ref:refs/heads/main",source)
  self.assertIn('payload.ref==="refs/heads/main"',source)
  self.assertIn("maxTokenAge:",source)
  self.assertIn("last_seen_at:checkedAt",source)
  self.assertIn("stamped.slice(n,n+40)",source)
  self.assertIn('source_url:SOURCE',source)
  # DBV 2027 officially reports windows longer than fourteen days (e.g. March–July).
  # Match the read-only parser ceiling instead of discarding the entire signed import.
  self.assertIn('if(days<0||days>366)throw Error("duration")',source)
  self.assertNotIn('if(days<0||days>14)throw Error("duration")',source)
  parser=(ROOT/"scripts/import-dbv-calendar.py").read_text()
  self.assertIn('(end-start).days>366',parser)
  self.assertNotIn("user_tournament_links?",source)
  self.assertIn('verify_jwt = false',(ROOT/"supabase/config.toml").read_text())

if __name__=="__main__":unittest.main()
