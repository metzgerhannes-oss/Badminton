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
         "clubId":"05-123","association":"Testverband",
         "discipline":"HE","gender":"M","points":1200,"tournaments":3,
         "overallRank":1}
        for i in range(1,count+1)
    ]

class PrivateDirectoryTests(unittest.TestCase):
    def test_offline_serialization_and_provenance(self):
        payload=json.loads(private.build_payload(sample(),2026,42))
        self.assertEqual(payload["total"],5001)
        self.assertEqual(len(set(p["id"] for p in payload["players"])),5001)
        self.assertTrue(all(p["lastSeen"]=="2026-KW42" for p in payload["players"]))
        self.assertEqual(payload["source"],"https://turniere.badminton.de/ranking")
        self.assertEqual(payload["rankingTotal"],5001)
        self.assertEqual(payload["players"][0]["rankings"][0][:4],["HE",1200,3,1])

    def test_reject_empty_or_partial_download(self):
        with self.assertRaisesRegex(ValueError,"outside safe range"):
            private.build_payload(sample(12),2026,42)

    def test_conflicting_identity_is_excluded(self):
        rows=sample()
        rows.append({**rows[0],"lastName":"Andereperson"})
        payload=json.loads(private.build_payload(rows,2026,42))
        self.assertEqual(payload["total"],5000)
        self.assertNotIn(rows[0]["id"],{p["id"] for p in payload["players"]})

    def test_rankings_do_not_depend_on_last_tournament_week(self):
        rows=sample()
        # A player who has not played this week still appears in the full
        # official weekly ranking, with valid published total points.
        rows[0]["tournaments"]=1
        rows[0]["points"]=790
        payload=json.loads(private.build_payload(rows,2026,42))
        first=next(p for p in payload["players"] if p["id"]==rows[0]["id"])
        self.assertEqual(first["rankings"][0][1],790)
        self.assertGreater(first["rankings"][0][3],1)

    def test_reject_incomplete_ranking_table(self):
        rows=sample()
        for row in rows[:1500]:
            row["discipline"]="XX"
        with self.assertRaisesRegex(ValueError,"ranking coverage too low"):
            private.build_payload(rows,2026,42)

    def test_official_ranking_date_without_week_heading(self):
        # The current public page contains a timestamp but may omit the KW title.
        ranking=private.load("scripts/update-ranking.py","current_ranking_stamp")
        page='<a href="/ranking/download">Download Rangliste als Excel-Datei</a><p>zuletzt aktualisiert: 21.10.2026 11:30:00</p>'
        year,week,stamp=ranking.official_publication_stamp(page)
        self.assertEqual((year,week),(2026,43))
        self.assertEqual(stamp.isoformat(),"2026-10-21T11:30:00+02:00")
        self.assertEqual(ranking.official_publication_stamp("Rangliste KW 43 "+page)[:2],(2026,43))
        with self.assertRaisesRegex(ValueError,"conflicts"):
            ranking.official_publication_stamp("Rangliste KW 42 "+page)
        with self.assertRaisesRegex(ValueError,"timestamp missing"):
            ranking.official_publication_stamp("<html>No official ranking date</html>")
        with self.assertRaisesRegex(ValueError,"timestamp invalid"):
            ranking.official_publication_stamp("zuletzt aktualisiert: invalid")

    def test_unavailable_current_excel_never_imports_older_archive(self):
        # A successful scheduled run must not silently call last week's data
        # CURRENT when the official current download is HTML or unavailable.
        class OfflineRanking:
            def current_public_export(self):
                return None
            def published_export(self, *args, **kwargs):
                raise AssertionError("stale archive fallback is forbidden")
        with (
            patch.object(private,"load",return_value=OfflineRanking()),
            patch.object(private,"build_payload",side_effect=AssertionError("no payload")),
        ):
            with self.assertRaisesRegex(RuntimeError,"refusing stale archive"):
                private.produce()

    def test_current_week_payload_is_used_without_archives(self):
        synthetic_rows=[{"id":"00-000001","firstName":"Test","lastName":"Player"}]
        class OfflineRanking:
            def current_public_export(self):
                return (2026,43,"https://example.invalid/current.xlsx",synthetic_rows,
                        "2026-10-21T11:30:00+02:00")
            def published_export(self, *args, **kwargs):
                raise AssertionError("archive fallback is forbidden")
        with (
            patch.object(private,"load",return_value=OfflineRanking()),
            patch.object(private,"build_payload",return_value=b"synthetic") as build,
        ):
            self.assertEqual(private.produce(),b"synthetic")
            build.assert_called_once_with(synthetic_rows,2026,43)

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
            def read(self):return b'{"ok":true,"count":5001,"snapshot":"2026-KW42","rankingCount":5001}'
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
        self.assertNotIn("  publish:",workflow)
        self.assertNotIn("--publish",workflow)
        self.assertNotIn("id-token: write",workflow)
        self.assertNotIn("secrets.",workflow)
        self.assertNotIn("git add data/",workflow)
        self.assertNotIn("upload-artifact",workflow)
        self.assertIn("jwtVerify(",edge)
        self.assertIn("payload.workflow_ref===WORKFLOW",edge)
        self.assertIn("maxTokenAge:",edge)
        next_sql=(ROOT/"supabase/migrations/20261016214500_private_weekly_rankings.sql").read_text()
        self.assertIn("pg_advisory_xact_lock",sql)
        self.assertIn("rankings_imported",next_sql)
        self.assertIn("not_listed_in_latest_official_export",next_sql)
        self.assertIn("LIMIT 8",next_sql)
        self.assertIn("rankingCount:result.rankings_imported",edge)
        self.assertIn("REVOKE ALL ON FUNCTION",sql)
        self.assertIn("TO service_role",sql)

if __name__=="__main__":
    unittest.main()
