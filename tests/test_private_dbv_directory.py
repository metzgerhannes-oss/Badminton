"""Completely offline synthetic tests for the private DBV ingest boundary."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("private_dbv",ROOT/"scripts/private-dbv-directory-import.py")
private=importlib.util.module_from_spec(spec)
spec.loader.exec_module(private)

def sample(count=5001):
    return [
        {"id":f"05-{i:06d}","firstName":"Synthetisch","lastName":f"Spieler{i}",
         "birthYear":2016,"ageClass":"U11","club":"Synthetischer Verein",
         "clubId":"05-123","association":"Testverband"}
        for i in range(1,count+1)
    ]

class PrivateDirectoryTests(unittest.TestCase):
    def test_offline_serialization_and_provenance(self):
        payload=json.loads(private.build_payload(sample(),2026,42))
        self.assertEqual(payload["total"],5001)
        self.assertEqual(len(set(p["id"] for p in payload["players"])),5001)
        self.assertTrue(all(p["lastSeen"]=="2026-KW42" for p in payload["players"]))
        self.assertEqual(payload["source"],"https://turniere.badminton.de/ranking")

    def test_reject_empty_or_partial_download(self):
        with self.assertRaisesRegex(ValueError,"outside safe range"):
            private.build_payload(sample(12),2026,42)

    def test_conflicting_identity_is_excluded(self):
        rows=sample()
        rows.append({**rows[0],"lastName":"Andereperson"})
        payload=json.loads(private.build_payload(rows,2026,42))
        self.assertEqual(payload["total"],5000)
        self.assertNotIn(rows[0]["id"],{p["id"] for p in payload["players"]})

    def test_oidc_guard_before_network(self):
        env={"GITHUB_REPOSITORY":private.REPOSITORY,
             "GITHUB_REF":"refs/pull/15/merge",
             "ACTIONS_ID_TOKEN_REQUEST_URL":"https://example.org/token",
             "ACTIONS_ID_TOKEN_REQUEST_TOKEN":"synthetic"}
        with self.assertRaisesRegex(RuntimeError,"Only the repository"):
            private.request_oidc_token(env)
        env["GITHUB_REF"]="refs/heads/main"
        env.pop("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
        with self.assertRaisesRegex(RuntimeError,"Missing GitHub OIDC"):
            private.request_oidc_token(env)

    def test_signed_send_only_no_player_logs(self):
        body=private.build_payload(sample(),2026,42)
        class FakeResponse:
            status=200
            def __enter__(self): return self
            def __exit__(self,*args):return False
            def read(self):return b'{"ok":true,"count":5001,"snapshot":"2026-KW42"}'
        with patch.object(private,"urlopen",return_value=FakeResponse()) as mock_network:
            private.publish(body,"synthetic-jwt-not-a-real-credential")
        req=mock_network.call_args.args[0]
        self.assertEqual(req.full_url,private.URL)
        self.assertEqual(req.get_method(),"POST")
        self.assertNotIn(b"SUPABASE_SERVICE_ROLE_KEY",req.data)

    def test_privacy_and_production_separation_contracts(self):
        workflow=(ROOT/".github/workflows/private-dbv-directory.yml").read_text()
        edge=(ROOT/"supabase/functions/private-dbv-directory/index.ts").read_text()
        sql=(ROOT/"supabase/migrations/20261016190000_private_dbv_directory_import.sql").read_text()
        self.assertIn("github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'",workflow)
        self.assertIn("id-token: write",workflow)
        self.assertNotIn("secrets.",workflow)
        self.assertNotIn("git add data/",workflow)
        self.assertNotIn("upload-artifact",workflow)
        self.assertIn("jwtVerify(",edge)
        self.assertIn("payload.workflow_ref===WORKFLOW",edge)
        self.assertIn("maxTokenAge:",edge)
        self.assertIn("pg_advisory_xact_lock",sql)
        self.assertIn("REVOKE ALL ON FUNCTION",sql)
        self.assertIn("TO service_role",sql)

if __name__=="__main__":
    unittest.main()
