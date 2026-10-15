"""Check historical source selection, BW state integrity, correct ages and dedupe."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("archive",ROOT/"scripts"/"import-bw-youth-archive.py")
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
def row(id,day,state="Baden-Württemberg",age=None,level="C"):
 return {"source_key":"dbv-calendar-"+str(id),"start_date":day,"end_date":day,
         "bundesland":state,"age_groups":age or ["U11","U13"],"level_group":level}
class ArchiveTests(unittest.TestCase):
 def test_all_dates_query(self):
  url=a.all_dates_url(2026)
  self.assertIn("remaining=all",url)
  self.assertNotIn("remaining=remaining",url)
  self.assertIn("year=2026",url)
 def test_does_not_invent_state_or_age(self):
  rows=[row(1,"2026-01-17"),row(2,"2026-04-25"),row(3,"2026-06-01","Gruppe Süd-Ost"),
        row(4,"2026-07-01",age=["O19"]),row(5,"2026-10-01",level="D"),
        row(6,"2026-10-10")]
  got=a.archived_bw_youth(rows,2026,"2026-10-05")
  self.assertEqual([x["source_key"] for x in got],["dbv-calendar-1","dbv-calendar-2"])
 def test_empty_or_future_only_is_rejected(self):
  with self.assertRaisesRegex(RuntimeError,"all-dates"):
   a.build_snapshot([row(1,"2026-10-25")],2026,"2026-10-15")
 def test_snapshot_honors_source(self):
  s=a.build_snapshot([row(1,"2026-01-17"),row(2,"2026-04-25")],2026,"2026-10-15")
  self.assertEqual(s["scope"],"historical-bw-youth-abc")
  self.assertEqual(s["source"],"https://turniere.badminton.de/")
  self.assertEqual(len(s["entries"]),2)
 def test_duplicate_identifiers_rejected(self):
  with self.assertRaisesRegex(RuntimeError,"Duplicate"):
   a.build_snapshot([row(1,"2026-01-17"),row(1,"2026-04-25")],2026,"2026-10-15")
if __name__=="__main__":unittest.main()
