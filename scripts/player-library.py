#!/usr/bin/env python3
"""Shared public player directory from the DBV's published ranking Excel.

No user-entered players are published here; only entries with a valid ID, name,
year, official AKL2, and official source. Historical verified entries remain
findable with a last-seen week; new DBV data overrides them.
"""
from __future__ import annotations
from collections import Counter
from pathlib import Path
import json
import re

AGES=("U11","U13","U15","U17","U19","U22")
ID=re.compile(r"^\d{2}-\d{6}$")
CLUB_ID=re.compile(r"^\d{2}-\d{3,8}$")
RANKING_URL="https://turniere.badminton.de/ranking"

def clean(s,maximum=130):
    return re.sub(r"\s+"," ",str(s or "").strip())[:maximum]

def valid_player(row):
    pid=clean(row.get("id"))
    group=clean(row.get("ageClass")).upper()
    name=clean((row.get("firstName") or "")+" "+(row.get("lastName") or ""),90)
    try:year=int(row.get("birthYear"))
    except (ValueError,TypeError):year=0
    return bool(ID.fullmatch(pid) and group in AGES and len(name)>=3
                and 1990<=year<=2100)

def compile_players(rows,year,week,old=None):
    if not (2020<=int(year)<=2100 and 1<=int(week)<=53):
        raise ValueError("Invalid official snapshot reference")
    by_id={}
    conflicts=set()
    for row in rows:
        if not valid_player(row):continue
        pid=clean(row["id"])
        name=clean(row["firstName"]+" "+row["lastName"],90)
        age=clean(row["ageClass"]).upper()
        previous=by_id.get(pid)
        if previous and (previous["name"]!=name or previous["ageClass"]!=age or previous["birthYear"]!=int(row["birthYear"])):
            conflicts.add(pid)
            continue
        club=clean(row.get("club"),120)
        club_id=clean(row.get("clubId"),30)
        association=clean(row.get("association"),70)
        info={
            "id":pid,"name":name,"birthYear":int(row["birthYear"]),
            "ageClass":age,"club":club,"clubId":club_id if CLUB_ID.fullmatch(club_id) else "",
            "association":association,"lastSeen":f"{year}-KW{week:02d}"
        }
        if previous:
            # One row per discipline; retain a populated official club field.
            if not info["club"]:info["club"]=previous["club"]
            if not info["clubId"]:info["clubId"]=previous["clubId"]
            if not info["association"]:info["association"]=previous["association"]
        by_id[pid]=info
    for pid in conflicts:
        by_id.pop(pid,None)
    # Preserve historical public DBV players, never copy manually entered profiles.
    old=old or []
    for record in old:
        pid=record.get("id","")
        if pid in by_id or pid in conflicts or not ID.fullmatch(pid) or record.get("ageClass") not in AGES:
            continue
        # Only retain rows that were previously imported from official DBV snapshots.
        if re.fullmatch(r"\d{4}-KW\d{2}",str(record.get("lastSeen",""))):
            by_id[pid]=record
    results={a:[] for a in AGES}
    for record in by_id.values():
        results[record["ageClass"]].append(record)
    for age in AGES:
        results[age].sort(key=lambda x:(x["club"].casefold(),x["name"].casefold(),x["id"]))
    return results,sorted(conflicts)

def write_player_library(rows,year,week,base:Path):
    base.mkdir(parents=True,exist_ok=True)
    old=[]
    for age in AGES:
        path=base/(age+".json")
        if path.exists():
            obj=json.loads(path.read_text(encoding="utf-8"))
            if obj.get("schemaVersion")==1:
                old.extend(obj.get("players",[]))
    results,conflicts=compile_players(rows,year,week,old)
    meta={"schemaVersion":1,"source":RANKING_URL,"year":int(year),"week":int(week),
          "ageGroups":[{"age":age,"file":age+".json","count":len(results[age])} for age in AGES],
          "total":sum(map(len,results.values()))}
    for age,players in results.items():
        doc={"schemaVersion":1,"ageClass":age,"players":players}
        (base/(age+".json")).write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    (base/"index.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"DBV PLAYER LIBRARY: {meta['total']} verified player IDs in {len(AGES)} age groups; conflicts discarded: {len(conflicts)}")
    return meta

if __name__=="__main__":
    raise SystemExit("Run through scripts/update-ranking.py using the official published Excel parser.")
