#!/usr/bin/env python3
"""Weekly DBV *published Excel* ranking snapshots. No tournament scraping.

A birth-year cohort rank is DERIVED from the official published points table,
and deliberately not confused with the DBV overall Rank column.
"""
from __future__ import annotations
import io
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "ranking.json"
OFFICIAL = "https://turniere.badminton.de"
HISTORY = OFFICIAL + "/ranking/history"
RELEASES = OFFICIAL + "/uploads/ranking/Ranking_{year}_KW{week:02d}.xlsx"
VALID_DISCIPLINES = ("HE", "HD", "HM", "DE", "DD", "DM")
HEADERS = {"dis":"discipline", "rang":"overall_rank", "spielerid":"player_id",
           "gjahr":"birth_year", "akl1":"age_detail","akl2":"age_class",
           "punkte":"points","turniere":"tournaments","gs":"gender",
           "nachname":"last_name","vorname":"first_name"}
MAX_BYTES = 48 * 1024 * 1024

def iso_week(d: datetime) -> tuple[int,int]:
    i = d.isocalendar()
    return (i.year, i.week)

def clean(value):
    return re.sub(r"\s+", "", str(value or "").strip().lower())

def points(value):
    if isinstance(value, (float,int)):
        return float(value)
    s = str(value or "").strip().replace("\u00a0", "").replace(" ", "")
    if not s:return None
    # DBV German display: 2.670 means 2670, not 2.67.
    if "," in s:
        s=s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+", s):
        s=s.replace(".", "")
    try:return float(s)
    except ValueError:return None

def parse_excel(contents: bytes) -> list[dict]:
    wb=load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    found=[]
    for ws in wb.worksheets:
        iterator=ws.iter_rows(values_only=True)
        header=None
        for index,row in enumerate(iterator):
            fields={clean(cell):j for j,cell in enumerate(row) if cell is not None}
            if all(x in fields for x in ("dis","spielerid","gjahr","punkte")):
                header=fields
                break
            if index >= 45:break
        if header is None:
            if os.environ.get("DEBUG_RANKING_SCHEMA")=="1":
                samples=[]
                for n,sample in enumerate(ws.iter_rows(values_only=True)):
                    if any(x is not None for x in sample):
                        samples.append([str(x)[:65] if x is not None else "" for x in sample[:18]])
                    if len(samples)>=8 or n>=35:break
                print("Ranking schema mismatch:",ws.title,"samples:",repr(samples),file=sys.stderr)
            continue
        for row in iterator:
            def val(key):
                idx=header.get(key)
                return row[idx] if idx is not None and idx<len(row) else None
            disc=str(val("dis") or "").strip().upper()
            pid=str(val("spielerid") or "").strip()
            p=points(val("punkte"))
            try:year=int(val("gjahr"))
            except (TypeError,ValueError):continue
            if disc not in VALID_DISCIPLINES or not re.fullmatch(r"\d\d-\d{6}",pid) or p is None:
                continue
            overall=val("rang")
            try:overall_rank=int(float(overall))
            except (TypeError,ValueError):overall_rank=None
            found.append({"id":pid,"discipline":disc,"birthYear":year,"points":p,
                "overallRank":overall_rank,"ageClass":str(val("akl2") or ""),
                "ageDetail":str(val("akl1") or ""),
                "gender":str(val("gs") or "").strip().upper(),
                "tournaments":int(val("turniere") or 0),
                "firstName":str(val("vorname") or "").strip(),
                "lastName":str(val("nachname") or "").strip()})
    wb.close()
    if not found:raise ValueError("No usable ranking table in official Excel")
    return found

def cohort_ranks(rows: list[dict]) -> dict[tuple[str,str],dict]:
    groups=defaultdict(list)
    for row in rows:
        groups[(row["discipline"],row["gender"],row["birthYear"])].append(row)
    ranked={}
    for (discipline,gender,year),items in groups.items():
        # Tie policy: same points = same cohort rank, equal to 1 + players above.
        order=sorted(items,key=lambda r:-r["points"])
        first_at_points={}
        for index,item in enumerate(order,1):
            first_at_points.setdefault(item["points"],index)
            record=dict(item)
            record["yearRank"]=first_at_points[item["points"]]
            record["cohortSize"]=len(order)
            # Duplicate player entries should not move a better rank.
            k=(item["id"],discipline)
            if k not in ranked or ranked[k]["yearRank"]>record["yearRank"]:
                ranked[k]=record
    return ranked

def published_export(when:datetime, max_lookback=6):
    for ago in range(max_lookback):
        year,week=iso_week(when-timedelta(weeks=ago))
        url=RELEASES.format(year=year,week=week)
        try:
            req=Request(url,headers={"User-Agent":"Schmetterlinge-Ranking/1.0 (weekly family cohort tracker)","Accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
            with urlopen(req,timeout=22) as resp:
                if resp.status!=200:continue
                sz=int(resp.headers.get("Content-Length") or 0)
                if sz>MAX_BYTES:raise ValueError("Excel archive exceeds size limit")
                binary=resp.read(MAX_BYTES+1)
                if len(binary)>MAX_BYTES:raise ValueError("Excel archive exceeds size limit")
            if not binary.startswith(b"PK"):raise ValueError("Not a valid xlsx ZIP file")
            yield year,week,url,parse_excel(binary)
        except HTTPError as e:
            if e.code in (404,410):continue
            if e.code in (401,403,429):
                print(f"Official archive denied automated access: HTTP {e.code}; skipping instead of retrying.",file=sys.stderr)
                return
            print(f"HTTP {e.code} from official archive",file=sys.stderr)
        except (URLError,ValueError,OSError,TimeoutError) as e:
            print(f"Archive unavailable: {type(e).__name__}: {e}",file=sys.stderr)

def summarize(now, before, id_list:list[str], checked:str):
    newest=(now[0],now[1])
    earlier=(before[0],before[1]) if before else None
    current=cohort_ranks(now[3])
    prior=cohort_ranks(before[3]) if before else {}
    players={}
    for pid in id_list:
        disciplines={}
        for dis in VALID_DISCIPLINES:
            r=current.get((pid,dis))
            if not r:continue
            p=prior.get((pid,dis))
            comparable=bool(p and p["birthYear"]==r["birthYear"])
            disciplines[dis]={
                "ageClass":r["ageClass"],"birthYear":r["birthYear"],
                "points":r["points"],"yearRank":r["yearRank"],
                "overallRank":r["overallRank"],"cohortSize":r["cohortSize"],
                "previousYearRank":p["yearRank"] if comparable else None,
                "previousPoints":p["points"] if comparable else None,
                "change":(p["yearRank"]-r["yearRank"]) if comparable else None,
                "tournaments":r["tournaments"]
            }
        if disciplines: players[pid]={"name":(next((r["firstName"]+" "+r["lastName"] for r in current.values() if r["id"]==pid),"")).strip(),"disciplines":disciplines}
    return {"schemaVersion":1,"status":"available","type":"dbv-published-excel-derived-birthyear-rank",
      "checkedAt":checked,
      "current":{"year":newest[0],"week":newest[1],"url":now[2]},
      "previous":{"year":earlier[0],"week":earlier[1],"url":before[2]} if before else None,
      "sourceUrl":HISTORY,"players":players,
      "method":"Rang im Geburtsjahr und der Disziplin = 1 + Zahl der punktstärkeren Spieler desselben Geburtsjahrs/Geschlechts. Nicht der offizielle Gesamt-Rang.",
      "notes":"Offizielle veröffentlichte Excel-Ranglisten. Nur öffentliche Spieler-IDs aus der konfigurierten Familien-Auswahl werden gespeichert. Veröffentlichungszeitpunkt ist nicht notwendig Donnerstag."}

def main():
    allow=[s.strip() for s in os.environ.get("BADMINTON_PLAYER_IDS","05-070879").split(",") if re.fullmatch(r"\d\d-\d{6}",s.strip())]
    if not allow:raise SystemExit("No valid player IDs")
    now=datetime.now(timezone.utc)
    checked=now.isoformat(timespec="seconds").replace("+00:00","Z")
    releases=[]
    for release in published_export(now):
        releases.append(release)
        if len(releases)==2:break
    if not releases:
        print("No official Excel export was obtainable; existing snapshot left unchanged.")
        return
    result=summarize(releases[0], releases[1] if len(releases)>1 else None, allow, checked)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    old=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else None
    if old and old.get("current")==result.get("current") and old.get("previous")==result.get("previous") and old.get("players")==result.get("players"):
        print("Same official calendar-week exports; no change in KPI snapshot.")
        return
    OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print("Saved official weekly ranking cohort snapshot:",result["current"],"previous",result["previous"],"players:",list(result["players"]))

if __name__=="__main__":
    main()
