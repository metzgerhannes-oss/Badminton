"""Offline regression tests for the official DBV calendar data contract."""
import importlib.util
from pathlib import Path
from unittest.mock import patch
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
 def test_direct_tournament_links_from_exact_details_only(self):
  # Both source records carry their direct links in the collapsed detail,
  # not in the eight visible columns.
  uuid1="E24DC6EE-152A-454D-B00C-E625B751D7D5"
  uuid2="9A0F8A11-6CB3-4586-900A-97CD0CB8B19C"
  example='''<!doctype html><body>2 Turniere gefunden
<table class="tournamenttable">
<tr data-target="#collapse44749"><td>22.11. - 22.11.</td><td>3. D-RLT BAW SW U11-U19</td>
<td>Gomaringen</td><td>Baden-Württemberg</td><td>D1-Level</td>
<td>U11: E/D<br>U13: E/D</td><td>15.11.2026</td><td></td></tr>
<tr class="hiddenrow"><td colspan="8"><div id="collapse44749">
<a href="https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5">Turnierseite</a>
<a href="https://evil.example/tournament/AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA">Unsicher</a>
</div></td></tr>
<tr data-target="#collapse43826"><td>05.12. - 06.12.</td><td>German Masters U11</td>
<td>Hofheim</td><td>DBV</td><td>A-Level</td><td>U11: E/D</td>
<td>10.11.2026</td><td></td></tr>
<tr class="hiddenrow"><td colspan="8"><div data-tournament="43826">
<a href="https://turnier.de/tournament/9a0f8a11-6cb3-4586-900a-97cd0cb8b19c">Offizielle Turnierseite</a>
<a href="https://turniere.badminton.de/">Kalenderübersicht</a>
</div></td></tr>
</table></body>'''
  rows=module.parse_page(example,2026)
  self.assertEqual(rows[0]["source_key"],"dbv-calendar-44749")
  self.assertEqual(rows[0]["event_url"],"https://dbv.turnier.de/tournament/"+uuid1)
  self.assertEqual(rows[1]["source_key"],"dbv-calendar-43826")
  self.assertEqual(rows[1]["event_url"],"https://dbv.turnier.de/tournament/"+uuid2)
  self.assertEqual(rows[1]["location_text"],"Hofheim")
  self.assertEqual(rows[1]["registration_deadline"],"2026-11-10")
 def test_real_calendar_ajax_protocol_and_verified_url(self):
  uuid="F849360D-AF7A-41E7-A20A-D438074A52CE"
  class Response:
   status=200
   url="https://turniere.badminton.de/ajax/tournament/43826"
   def __enter__(self):return self
   def __exit__(self,*a):return False
   def read(self,n):
    return ('<a href="https://cloud.badminton.de/index.php/s/example">Ausschreibung</a>'+
     '<a href="https://dbv.turnier.de/tournament/'+uuid+'">Turnier</a>'+
     '<a href="https://turniere.badminton.de/downloadIcs/43826">Kalender</a>').encode()
  with patch.object(module,"urlopen",return_value=Response()) as mocked:
   self.assertEqual(module.read_event_details("43826"),"https://dbv.turnier.de/tournament/"+uuid)
   request=mocked.call_args.args[0]
   self.assertEqual(request.get_method(),"POST")
   self.assertEqual(request.data,b"jwsfilter=0")
   self.assertEqual(request.full_url,"https://turniere.badminton.de/ajax/tournament/43826")
  with self.assertRaises(ValueError):module.read_event_details("../etc/passwd")
 def test_ajax_enrichment_keeps_calendar_source_key_and_date(self):
  uuid="31F12648-7085-429B-9A91-EC70D526343B"
  details=lambda identifier:"https://dbv.turnier.de/tournament/"+uuid if identifier=="44094" else None
  rows=module.parse_page(HTML,2026,detail_fetcher=details)
  self.assertEqual(rows[0]["event_url"],"https://dbv.turnier.de/tournament/"+uuid)
  self.assertEqual(rows[0]["start_date"],"2026-11-06")
  self.assertIsNone(rows[1]["event_url"])
 def test_ajax_network_failure_does_not_publish_partial_calendar(self):
  def failed(_):raise OSError("source unavailable")
  with self.assertRaises(OSError):module.parse_page(HTML,2026,detail_fetcher=failed)
 def test_no_cross_assignment_of_expanded_details(self):
  uuid="E24DC6EE-152A-454D-B00C-E625B751D7D5"
  source=HTML.replace("<div data-tournament=\"44094\"></div>",
    '<div id="collapse44094"><a href="https://dbv.turnier.de/tournament/'+uuid+'">Detail</a></div>')
  rows=module.parse_page(source,2026)
  self.assertEqual(rows[0]["event_url"],"https://dbv.turnier.de/tournament/"+uuid)
  self.assertIsNone(rows[1]["event_url"])
  duplicate=source.replace("</div>",'<a href="https://dbv.turnier.de/tournament/AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA">Fremdturnier</a></div>',1)
  self.assertIsNone(module.parse_page(duplicate,2026)[0]["event_url"])
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
