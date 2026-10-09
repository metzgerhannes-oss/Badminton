import io
import unittest
from openpyxl import Workbook
from update_ranking import parse_excel, cohort_ranks, summarize, iso_week,points
from datetime import datetime,timezone

def make_xlsx():
    wb=Workbook()
    ws=wb.active
    ws.append(["DIS","Rang","FRang","Nachname","Vorname","GS","SpielerID","GJahr","AKL1","AKL2","Punkte","Turniere"])
    ws.append(["HE",1900,1900,"Metzger","Philipp","M","05-070879",2016,"U11-2","U11",2670,10])
    ws.append(["HE",1901,1901,"Andere","Spieler","M","05-000111",2016,"U11-2","U11",3000,10])
    ws.append(["HE",1902,1902,"Dritter","Spieler","M","05-000112",2016,"U11-2","U11",2670,10])
    ws.append(["HE",1903,1903,"Jahrgang","Different","M","05-000113",2015,"U13-1","U13",99999,10])
    ws.append(["HD",2398,2398,"Metzger","Philipp","M","05-070879",2016,"U11-2","U11",1322,3])
    ws.append(["HD",2397,2397,"Partner","Spieler","M","05-000111",2016,"U11-2","U11",2000,3])
    x=io.BytesIO();wb.save(x);return x.getvalue()

class RankingTests(unittest.TestCase):
    def test_german_numbers(self):
        self.assertEqual(points("2.670"),2670)
        self.assertEqual(points("2.670,50"),2670.50)
        self.assertEqual(points(2670),2670)
    def test_headers_and_cohorts(self):
        rows=parse_excel(make_xlsx())
        ranks=cohort_ranks(rows)
        p=ranks[("05-070879","HE")]
        self.assertEqual(p["birthYear"],2016)
        self.assertEqual(p["yearRank"],2)
        self.assertEqual(p["cohortSize"],3)
        self.assertEqual(p["overallRank"],1900)
        self.assertEqual(ranks[("05-070879","HD")]["yearRank"],2)
    def test_compare(self):
        rows=parse_excel(make_xlsx())
        now=(2026,40,"https://example.invalid/KW40.xlsx",rows)
        before=[dict(r) for r in rows]
        for r in before:
            if r["id"]=="05-070879" and r["discipline"]=="HE":
                r["points"]=3100
        prev=(2026,39,"https://example.invalid/KW39.xlsx",before)
        result=summarize(now,prev,["05-070879"],"2026-10-09T17:00:00Z")
        delta=result["players"]["05-070879"]["disciplines"]["HE"]
        self.assertEqual(delta["yearRank"],2)
        self.assertEqual(delta["previousYearRank"],1)
        self.assertEqual(delta["change"],-1)
        self.assertEqual(result["current"]["week"],40)
        self.assertEqual(result["previous"]["week"],39)
    def test_year_boundary(self):
        self.assertEqual(iso_week(datetime(2026,1,1,tzinfo=timezone.utc)),(2026,1))
if __name__=="__main__":
    unittest.main()
