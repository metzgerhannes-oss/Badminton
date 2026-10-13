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
  self.assertIn("days>366",source,"Verify the server accepts published long-running DBV series from 2027")
  self.assertNotIn("days>14",source,"Old 14-day limiter must not reject the entire year")
  self.assertIn("last_seen_at:checkedAt",source)
  self.assertIn("stamped.slice(n,n+40)",source)
  self.assertIn('source_url:SOURCE',source)
  self.assertNotIn("user_tournament_links?",source)
  self.assertIn('verify_jwt = false',(ROOT/"supabase/config.toml").read_text())


 def test_long_running_calendar_payload_is_preserved_without_network(self):
  """A 132-day test event must survive client serialisation; NO real publishing."""
  from datetime import date
  start,end="2027-03-13","2027-07-23"
  self.assertGreater((date.fromisoformat(end)-date.fromisoformat(start)).days,14)
  fixture={
   "source_key":"dbv-calendar-123456","title":"Synthetic OIDC test fixture",
   "start_date":start,"end_date":end,"location_text":"Testort",
   "organizer":"Testorganisation","bundesland":None,"region_scope":"unknown",
   "category":"C-Level","level_group":"C","age_groups":["U13"],
   "disciplines":["Einzel"],"registration_deadline":None,
   "event_url":None,"source_url":"https://turniere.badminton.de/"
  }
  payload={"entries":[fixture],"expectedCount":1}
  class FakeResponse:
   status=200
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self):return b'{"ok":true,"count":1}'
  with patch.object(oidc,"urlopen",return_value=FakeResponse()) as fake_network:
   oidc.send(payload,"mock-github-oidc-token")
  request=fake_network.call_args.args[0]
  serialized=json.loads(request.data.decode("utf-8"))
  self.assertEqual((serialized["entries"][0]["start_date"],serialized["entries"][0]["end_date"]),(start,end))
  self.assertEqual(request.full_url,oidc.FUNCTION)
  self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY",request.headers)
  # Future server changes must not silently restore the obsolete 14-day cap.
  source=(ROOT/"supabase/functions/dbv-calendar-publish/index.ts").read_text()
  self.assertIn("if(days<0||days>366)",source)
  self.assertNotIn("if(days<0||days>14)",source)

if __name__=="__main__":unittest.main()
