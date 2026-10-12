"""Offline regression tests for the official DBV calendar data contract."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("calendar_import",ROOT/"scripts"/"import-dbv-calendar.py")
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
HTML='''<!doctype html>
<html><body>2 Turniere gefunden
<table class="tournamenttable"><thead><tr><th>Datum</th></tr></thead><tbody>
<tr style="cursor:pointer" data-target="#collapse44094">
<td>06.11. - 08.11.</td><td>Norddeutsche Meisterschaften U13-U19</td>
<td>Berlin</td><td>Gruppe Nord</td><td>B-Level</td>
<td>U13: E/D/M<br>U15: E/D/M<br>U17: E/D/M<br>U19: E/D/M</td>
<td>16.10.2026</td><td><a href="/uploads/44094.pdf">PDF</a></td>
</tr><tr class="hiddenrow"><td colspan="8"><div data-tournament="44094"></div></td></tr>
<tr data-target="#collapse44659"><td>17.10. - 18.10.</td>
<td>C-RLT SAA O19</td><td>Oberthal</td><td>Saarland</td>
<td>C2-Level</td><td>O19: E/D/M</td><td>11.10.2026</td><td></td></tr>
</tbody></table></body></html>'''

class CalendarTests(unittest.TestCase):
 def test_age_level_regions_and_source_ids(self):
  rows=module.parse_page(HTML,2026)
  self.assertEqual(len(rows),2)
  a,b=rows
  self.assertEqual(a["source_key"],"dbv-calendar-44094")
  self.assertEqual(a["age_groups"],["U13","U15","U17","U19"])
  self.assertEqual(a["disciplines"],["Einzel","Doppel","Mixed"])
  self.assertEqual(a["start_date"],"2026-11-06")
  self.assertEqual(a["region_scope"],"group")
  self.assertIsNone(a["bundesland"],"Group Nord is not the geographic state of Berlin")
  self.assertEqual(b["category"],"C2-Level")
  self.assertEqual(b["level_group"],"C")
  self.assertEqual(b["bundesland"],"Saarland")
  self.assertEqual(b["registration_deadline"],"2026-10-11")
  self.assertIsNone(a["event_url"],"A PDF link must not be mislabelled an official match page")
 def test_source_count_guard(self):
  with self.assertRaisesRegex(ValueError,"Source mismatch"):
   module.parse_page(HTML.replace("2 Turniere gefunden","3 Turniere gefunden"),2026)
 def test_no_guessed_age_or_name_from_pdf(self):
  bad=HTML.replace("U13: E/D/M<br>U15: E/D/M<br>U17: E/D/M<br>U19: E/D/M","")
  with self.assertRaisesRegex(ValueError,"Unusable"):
   module.parse_page(bad,2026)
 def test_long_source_published_2027_range(self):
  self.assertEqual(module.date_pair("13.03. - 23.07.",2027),("2027-03-13","2027-07-23"))
  self.assertEqual(module.date_pair("30.12. - 02.01.",2027),("2027-12-30","2028-01-02"))
  with self.assertRaises(ValueError):
   module.date_pair("31.02. - 01.03.",2027)
 def test_filters_include_categories_and_associations(self):
  qs=module.calendar_url(2026)
  self.assertIn("agegroup%5B%5D=U11",qs)
  self.assertIn("federation%5B%5D=70",qs)
  self.assertIn("category%5B%5D=108",qs)
  self.assertIn("year=2026",qs)

if __name__=="__main__":unittest.main()
