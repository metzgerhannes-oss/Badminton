#!/usr/bin/env python3
"""Import verified past BW youth A/B/C rows from the public DBV *all dates* view.

Separate from the future-event Supabase/OIDC writer. Unlisted BWBV events are
not fabricated, and regional group tournaments are not assigned a state.
"""
import argparse
import datetime as dt
import importlib.util
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode

ROOT=Path(__file__).resolve().parents[1]
SOURCE="https://turniere.badminton.de/"
OUT=ROOT/"data"/"bw-youth-calendar-archive.json"
spec=importlib.util.spec_from_file_location("dbv_import",ROOT/"scripts"/"import-dbv-calendar.py")
dbv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(dbv)
LEVELS={"A","B","C"}
AGES={"U11","U13","U15","U17","U19"}

def all_dates_url(year):
    # The published DBV manual requires the date filter to be changed from
    # 'verbleibende Turniere' to 'alle Turniere' for searches in the past.
    # Preserve exactly the same category/age/federation filters as the live feed.
    url=dbv.calendar_url(year)
    if "remaining=remaining" not in url:
        raise ValueError("DBV remaining-date parameter changed")
    return url.replace("remaining=remaining","remaining=all")

def archived_bw_youth(rows,year,today):
    result=[]
    for row in rows:
        if row["start_date"][:4]!=str(year) or row["end_date"]>=today:
            continue
        if row["bundesland"]!="Baden-Württemberg" or row["level_group"] not in LEVELS:
            continue
        if not AGES.intersection(row["age_groups"]):
            continue
        result.append(row)
    return sorted(result,key=lambda r:(r["start_date"],r["source_key"]))

def fetch_all(year):
    url=all_dates_url(year)
    request=Request(url,headers={"User-Agent":"Schmetterlinge-PublicDBV-Archive/1.0 (+https://github.com/metzgerhannes-oss/Badminton)",
                                 "Accept":"text/html"})
    with urlopen(request,timeout=35) as response:
        if response.status!=200 or response.url.split("/")[2]!="turniere.badminton.de":
            raise RuntimeError("Unexpected DBV historical calendar response")
        body=response.read(12_000_001)
    if len(body)>12_000_000:
        raise RuntimeError("DBV annual historical view exceeds the read limit")
    return dbv.parse_page(body.decode("utf-8","replace"),year)

def build_snapshot(rows,year,today):
    selected=archived_bw_youth(rows,year,today)
    # Fail closed if the all-dates parameter silently reverts to 'remaining'.
    if str(year)=="2026" and (not selected or not any(r["start_date"]<"2026-08-01" for r in selected)):
        raise RuntimeError("DBV all-dates view did not provide historical BW A/B/C youth tournaments")
    ids=[r["source_key"] for r in selected]
    if len(ids)!=len(set(ids)):raise RuntimeError("Duplicate DBV tournament identifiers in BW archive")
    return {"schemaVersion":1,"source":SOURCE,"scope":"historical-bw-youth-abc",
            "year":year,"entries":selected}

def write_snapshot(snapshot,path=OUT):
    path.parent.mkdir(parents=True,exist_ok=True)
    # Carry already source-verified past years forward; the current year fetch
    # replaces matching source IDs without deleting earlier played tournaments.
    years={snapshot["year"]}
    if path.exists():
        try:
            old=json.loads(path.read_text(encoding="utf-8"))
            if old.get("source")==SOURCE and old.get("scope")=="historical-bw-youth-abc":
                years.update(old.get("years") or [old.get("year")])
                keys={r["source_key"]:r for r in old.get("entries",[]) if r.get("source_key")}
                keys.update({r["source_key"]:r for r in snapshot["entries"]})
                snapshot["entries"]=sorted(keys.values(),key=lambda r:(r["start_date"],r["source_key"]))
        except (ValueError,TypeError,KeyError):pass
    snapshot["years"]=sorted(y for y in years if isinstance(y,int))
    if path.exists():
        try:
            old=json.loads(path.read_text(encoding="utf-8"))
            if all(old.get(k)==snapshot[k] for k in ("schemaVersion","source","scope","year","entries","years")):
                print("BW historical archive unchanged",flush=True)
                return
        except (ValueError,KeyError,TypeError):pass
    snapshot["capturedAt"]=dt.datetime.now(dt.timezone.utc).isoformat()
    path.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--year",type=int,default=dt.datetime.now().year)
    p.add_argument("--write-json",action="store_true")
    args=p.parse_args()
    if args.year<2026 or args.year>2100:raise ValueError("Unsupported historical year")
    today=dt.datetime.now(dt.timezone.utc).date().isoformat()
    rows=fetch_all(args.year)
    snapshot=build_snapshot(rows,args.year,today)
    print("DBV annual view:",len(rows),"events; past BW youth A/B/C:",len(snapshot["entries"]),flush=True)
    if args.write_json:write_snapshot(snapshot)

if __name__=="__main__":main()
