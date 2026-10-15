"""Strict official 2027 BW youth A/B/C planning source regression."""
import importlib.util, json, tempfile
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location("bwbv",ROOT/"scripts"/"import-bwbv-youth-calendar.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
PDF="""Termine 2026/2027 Jugend
• 16./17.1.2027 1. BWBV/C-RLT (E/D)
• 27./28.2.2027 2. BWBV/C-RLT (E/M)
• 8./9.5.2027 3. BWBV/C-RLT (E/D)
• 26./27.6.2027 4. BWBV/C-RLT (E/D/MX,
23. Hexen-Cup)
Gruppe SüdOst
• 30./31.1.2027 3.B-RLT U13-U19 BAW
"""
HTML="""<html><table><tr><td>2. A-RLT</td><td>U11/U13</td><td>BC Lörrach-Brombach</td><td>20./21.02.2027</td></tr><tr><td>4. A-RLT</td><td>U11/U13</td><td>BSV Eggenstein</td><td>24./25.04.2027</td></tr></table></html>"""
class ImportTests(unittest.TestCase):
 def test_exact_events(self):
  d=m.make_snapshot(PDF,HTML)
  self.assertEqual(len(d["entries"]),7)
  self.assertEqual({k:sum(row["level"]==k for row in d["entries"]) for k in "ABC"},{"A":2,"B":1,"C":4})
  a=[r for r in d["entries"] if r["level"]=="A"]
  self.assertEqual([x["start"] for x in a],["2027-02-20","2027-04-24"])
  self.assertEqual({r["key"] for r in a},{"dbv-bw-a-2027-2","dbv-bw-a-2027-4"})
 def test_correct_age_restrictions(self):
  d=m.make_snapshot(PDF,HTML)
  c={r["key"]:r for r in d["entries"] if r["level"]=="C"}
  self.assertIn("U11",c["bwbv-2027-c-1"]["ages"])
  self.assertNotIn("U11",c["bwbv-2027-c-2"]["ages"])
  self.assertIn("U11",c["bwbv-2027-c-3"]["ages"])
  self.assertNotIn("U11",c["bwbv-2027-c-4"]["ages"])
  self.assertTrue(all(r["status"]=="planned" and r["source"].startswith("https://") for r in d["entries"]))
 def test_fail_closed_on_missing_or_moved_event(self):
  with self.assertRaisesRegex(ValueError,"four individually dated"):
   m.make_snapshot(PDF.replace("27./28.2.2027","25./26.2.2026"),HTML)
  with self.assertRaisesRegex(ValueError,"host/date"):
   m.make_snapshot(PDF,HTML.replace("20./21.02.2027","12./13.02.2027").replace("BC Lörrach-Brombach","Random Club"))
 def test_preserve_verified_dates_across_reruns(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/"output.json"
   m.write_snapshot(m.make_snapshot(PDF,HTML),path)
   s=path.read_bytes()
   m.write_snapshot(m.make_snapshot(PDF,HTML),path)
   self.assertEqual(path.read_bytes(),s)
 def test_no_synthetic_registration_identity(self):
  d=m.make_snapshot(PDF,HTML)
  self.assertTrue(all("event_url" not in r and "registration_deadline" not in r for r in d["entries"]))
if __name__=="__main__":unittest.main()
