import io
import unittest
import importlib.util
from pathlib import Path
from datetime import datetime,timezone
from unittest.mock import patch
from openpyxl import Workbook
spec=importlib.util.spec_from_file_location("ranking_update",Path(__file__).with_name("update-ranking.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
parse_excel=module.parse_excel
cohort_ranks=module.cohort_ranks
summarize=module.summarize
iso_week=module.iso_week
points=module.points

def make_xlsx(real=False):
    wb=Workbook()
    ws=wb.active
    ws.append(["DIS","Ranglistenplatz" if real else "Rang","FRang","Nachname","Vorname","GS","SpielerID","GJahr","AKL1","AKL2","Points" if real else "Punkte","Turniere","LVName"])
    # 2017 player is U11 too, and must count ahead of Philipp in DE and BW.
    fixtures=[
      ["HE",1900,1900,"Metzger","Philipp","M","05-070879",2016,"U11-2","U11",2670,10,"BAW-Baden-Württemberg"],
      ["HE",1901,1901,"Younger","Player","M","05-000111",2017,"U11-1","U11",3000,10,"BAW-Baden-Württemberg"],
      ["HE",1902,1902,"Tied","Player","M","05-000112",2017,"U11-1","U11",2670,10,"BAW-Baden-Württemberg"],
      ["HE",1903,1903,"Other","Player","M","05-000113",2016,"U11-2","U11",3400,10,"BAY-Bayern"],
      ["HE",1904,1904,"Older","Player","M","05-000114",2015,"U13-1","U13",99999,10,"BAW-Baden-Württemberg"],
      ["DE",1905,1905,"Female","Player","W","05-000115",2017,"U11-1","U11",99999,10,"BAW-Baden-Württemberg"],
      ["HD",2398,2398,"Metzger","Philipp","M","05-070879",2016,"U11-2","U11",1322,3,"BAW-Baden-Württemberg"],
      ["HD",2397,2397,"Younger","Partner","M","05-000116",2017,"U11-1","U11",2000,3,"BAY-Bayern"],
      ["DE",2771,2773,"Metzger","Charlotte","F","05-071969",2014,"U13-2","U13",611,2,"BAW-Baden-Württemberg"],
      ["DE",2000,2000,"Andere","Spielerin","F","05-000118",2015,"U13-1","U13",900,3,"BAW-Baden-Württemberg"],
    ]
    for r in fixtures:ws.append(r)
    out=io.BytesIO();wb.save(out);return out.getvalue()

class RankingTests(unittest.TestCase):
    def test_german_numbers(self):
        self.assertEqual(points("2.670"),2670)
        self.assertEqual(points("2.670,50"),2670.50)
        self.assertEqual(points(2670),2670)
    def test_official_age_class_includes_younger_birth_years(self):
        rows=parse_excel(make_xlsx())
        rows_real=parse_excel(make_xlsx(real=True))
        self.assertEqual(len(rows_real),len(rows))
        self.assertEqual(rows_real[0]["points"],2670)
        ranks=cohort_ranks(rows)
        philipp=ranks[("05-070879","HE")]
        self.assertEqual(philipp["ageClass"],"U11")
        self.assertEqual(philipp["birthYear"],2016)
        self.assertEqual(philipp["ageClassRank"],3) # 2017 BW 3000 and 2016 Bavaria 3400
        self.assertEqual(philipp["ageClassSize"],4)
        self.assertEqual(ranks[("05-000111","HE")]["ageClassRank"],2)
        self.assertEqual(ranks[("05-000112","HE")]["ageClassRank"],3) # points tie
        self.assertEqual(ranks[("05-070879","HD")]["ageClassRank"],2)
        self.assertEqual(philipp["association"],"BAW-Baden-Württemberg")
        # Older U13 and female DE cannot affect the male U11 HE rank.
        self.assertNotIn("05-000114",[x["id"] for x in rows if x["ageClass"]=="U11"])
    def test_charlotte_verified_dbv_id_and_u13_competition(self):
        rows=parse_excel(make_xlsx(real=True))
        charlotte=next(r for r in rows if r["id"]=="05-071969")
        self.assertEqual(charlotte["firstName"],"Charlotte")
        self.assertEqual(charlotte["lastName"],"Metzger")
        self.assertEqual(charlotte["birthYear"],2014)
        self.assertEqual(charlotte["ageClass"],"U13")
        self.assertEqual(charlotte["gender"],"F")
        self.assertEqual(charlotte["points"],611)
        self.assertEqual(charlotte["association"],"BAW-Baden-Württemberg")
        ranks=cohort_ranks(rows)
        self.assertEqual(ranks[("05-071969","DE")]["ageClassRank"],2)
        snap=summarize((2026,41,"https://example.invalid/current",rows),None,
                       ["05-070879","05-071969"],"2026-10-09T20:00:00Z")
        self.assertIn("05-071969",snap["players"])
        self.assertEqual(snap["players"]["05-071969"]["disciplines"]["DE"]["bwAgeClassRank"],2)
        self.assertNotIn("HD",snap["players"]["05-071969"]["disciplines"])
    def test_bw_and_germany_age_class_week_comparison(self):
        rows=parse_excel(make_xlsx())
        now=(2026,40,"https://example.invalid/KW40.xlsx",rows)
        previous=[dict(r) for r in rows]
        for r in previous:
            if r["id"]=="05-070879" and r["discipline"]=="HE":
                r["points"]=3100
        before=(2026,39,"https://example.invalid/KW39.xlsx",previous)
        result=summarize(now,before,["05-070879"],"2026-10-09T17:00:00Z")
        self.assertEqual(result["schemaVersion"],2)
        r=result["players"]["05-070879"]["disciplines"]["HE"]
        self.assertEqual(r["ageClass"],"U11")
        self.assertEqual(r["ageClassRank"],3)
        self.assertEqual(r["ageClassSize"],4)
        self.assertEqual(r["bwAgeClassRank"],2)
        self.assertEqual(r["bwAgeClassSize"],3)
        self.assertEqual(r["previousAgeClassRank"],2)
        self.assertEqual(r["previousBwAgeClassRank"],1)
        self.assertEqual(r["ageClassChange"],-1)
        self.assertEqual(r["bwAgeClassChange"],-1)
        self.assertEqual(result["current"]["week"],40)
        self.assertEqual(result["region"],"BAW-Baden-Württemberg")
        self.assertEqual(r["points"],2670)
        self.assertEqual(r["countedLimit"],5)
        self.assertEqual(r["topFive"],[])
        self.assertEqual(r["topFiveStatus"],"not-in-public-export")
        self.assertEqual(result["players"]["05-070879"]["disciplines"]["HD"]["countedLimit"],5)
    def test_age_group_transition_suppresses_week_comparison(self):
        rows=parse_excel(make_xlsx())
        prev=[dict(r) for r in rows]
        for r in prev:
            if r["id"]=="05-070879":r["ageClass"]="U13"
        output=summarize((2027,1,"https://example.invalid/a",rows),(2026,52,"https://example.invalid/b",prev),["05-070879"],"2027-01-09T00:00:00Z")
        self.assertIsNone(output["players"]["05-070879"]["disciplines"]["HE"]["previousAgeClassRank"])
        self.assertIsNone(output["players"]["05-070879"]["disciplines"]["HE"]["previousBwAgeClassRank"])
    def test_current_official_excel_download(self):
        class Response:
            status=200
            def __init__(self,content):self.content=content
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,*args):return self.content
        html=b'<html><a>Rangliste KW 41</a><div>zuletzt aktualisiert: <a>07.10.2026 12:00:00</a></div></html>'
        with patch.object(module,"urlopen",side_effect=[Response(html),Response(make_xlsx(real=True))]):
            latest=module.current_public_export()
        self.assertEqual(latest[:2],(2026,41))
        self.assertEqual(latest[2],"https://turniere.badminton.de/ranking/download")
        self.assertEqual(next(r for r in latest[3] if r["id"]=="05-070879")["points"],2670)
        self.assertEqual(latest[4],"2026-10-07T12:00:00+02:00")
    def test_never_downgrade_current_source_to_old_archive(self):
        current={"schemaVersion":2,"status":"available","current":{"year":2026,"week":41,"kind":"current-export","sourceUpdatedAt":"2026-10-07T12:00:00+02:00"}}
        older={"schemaVersion":2,"status":"available","current":{"year":2026,"week":40,"kind":"weekly-archive"}}
        same_week_archive={"schemaVersion":2,"status":"available","current":{"year":2026,"week":41,"kind":"weekly-archive"}}
        newer={"schemaVersion":2,"status":"available","current":{"year":2026,"week":42,"kind":"current-export"}}
        self.assertFalse(module.should_publish(current,older))
        self.assertFalse(module.should_publish(current,same_week_archive))
        self.assertTrue(module.should_publish(current,newer))
        self.assertTrue(module.should_publish(None,current))
    def test_year_boundary(self):
        self.assertEqual(iso_week(datetime(2026,1,1,tzinfo=timezone.utc)),(2026,1))
if __name__=="__main__":
    unittest.main()
