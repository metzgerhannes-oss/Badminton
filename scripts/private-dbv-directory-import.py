#!/usr/bin/env python3
"""Official DBV Excel -> private atomic Supabase directory import.

Never writes source player names to the public repo, build logs, or artifacts.
A signed short-lived GitHub OIDC identity replaces stored database secrets.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
AUDIENCE="schmetterlinge-private-dbv-directory-yadexibmjmnjfmfabrug"
URL="https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/private-dbv-directory"
REPOSITORY="metzgerhannes-oss/Badminton"
MAX_BODY=4_800_000
SOURCE="https://turniere.badminton.de/ranking"

def load(path, name):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def build_payload(rows,year,week):
    library=load("scripts/player-library.py","dbv_player_library")
    groups,conflicts=library.compile_players(rows,year,week)
    players=[p for age in library.AGES for p in groups[age]]
    if len(players)<5000 or len(players)>20000:
        raise ValueError("Official DBV directory count outside safe range")
    if len(conflicts)>200:
        raise ValueError("Too many contradictory official DBV identities")
    # Build positions from the entire official published ranking table, not merely
    # players who played in the publication week. Rankings roll forward weekly.
    ranking=load("scripts/update-ranking.py","dbv_complete_weekly_ranking")
    national=ranking.cohort_ranks(rows)
    bw=ranking.cohort_ranks([r for r in rows if r.get("association")==ranking.BW_ASSOCIATION])
    rank_count=0
    for player in players:
        player["rankings"]=[]
        for discipline in ranking.VALID_DISCIPLINES:
            record=national.get((player["id"],discipline))
            if not record:
                continue
            regional=bw.get((player["id"],discipline))
            if record["points"]<0 or not float(record["points"])<1_000_000_000:
                raise ValueError("Invalid official aggregate ranking points")
            # Six compact positional fields: discipline, total points, counted
            # tournaments, German cohort rank, BW cohort rank, DBV overall rank.
            player["rankings"].append([
                discipline,record["points"],record["tournaments"],
                record["ageClassRank"],regional["ageClassRank"] if regional else None,
                record["overallRank"] if record["overallRank"] and record["overallRank"]>0 else None
            ])
            rank_count+=1
    if rank_count<int(len(players)*0.80):
        raise ValueError("Official ranking coverage too low; import rejected")
    payload={"source":SOURCE,"year":year,"week":week,"total":len(players),
             "rankingTotal":rank_count,"players":players}
    encoded=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    if len(encoded)>MAX_BODY:
        raise ValueError("Verified directory payload exceeds size limit")
    # The only audit output contains aggregated counts, never names or DBV IDs.
    print("Verified official DBV directory:",len(players),"players;",len(conflicts),"conflicts excluded")
    return encoded

def request_oidc_token(env=os.environ):
    if env.get("GITHUB_REPOSITORY")!=REPOSITORY or env.get("GITHUB_REF")!="refs/heads/main":
        raise RuntimeError("Only the repository main workflow can update the directory")
    url=env.get("ACTIONS_ID_TOKEN_REQUEST_URL","")
    bearer=env.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN","")
    if not url.startswith("https://") or not bearer:
        raise RuntimeError("Missing GitHub OIDC runtime")
    sep="&" if "?" in url else "?"
    req=Request(url+sep+"audience="+quote(AUDIENCE,safe=""),
        headers={"Authorization":"bearer "+bearer,"Accept":"application/json"})
    with urlopen(req,timeout=15) as rsp:
        if rsp.status!=200:
            raise RuntimeError("Could not obtain GitHub OIDC identity")
        token=json.load(rsp).get("value","")
    if not isinstance(token,str) or not 200<=len(token)<=10000:
        raise RuntimeError("Invalid GitHub OIDC identity")
    return token

def publish(body,token):
    if len(body)>MAX_BODY:
        raise ValueError("Payload too large")
    payload=json.loads(body)
    if payload["total"]!=len(payload["players"]) or payload["total"]<5000 or\
       payload.get("rankingTotal",0)<int(payload["total"]*0.80):
        raise ValueError("Invalid player count")
    req=Request(URL,method="POST",data=body,headers={
        "Authorization":"Bearer "+token,"Content-Type":"application/json",
        "Accept":"application/json"
    })
    try:
        with urlopen(req,timeout=115) as rsp:
            result=json.load(rsp)
            if rsp.status!=200 or result.get("ok") is not True or result.get("count")!=payload["total"]:
                raise RuntimeError("Directory writer did not confirm complete snapshot")
    except HTTPError as e:
        # Avoid printing request tokens or personal payloads even on errors.
        raise RuntimeError("Directory writer returned HTTP "+str(e.code)) from None
    except URLError:
        raise RuntimeError("Directory writer not reachable") from None
    if result.get("rankingCount")!=payload["rankingTotal"]:
        raise RuntimeError("Rankings were not fully confirmed by the database")
    print("Private DBV directory and CURRENT ranking synced:",result["snapshot"],
          result["count"],"players;",result["rankingCount"],"discipline totals")

def produce():
    ranking=load("scripts/update-ranking.py","official_dbv_ranking")
    live=ranking.current_public_export()
    if live is None:
        # Never report a successful CURRENT weekly import from an older archive.
        # If the current official XLSX is unavailable or is HTML instead,
        # preserve the last verified snapshot and fail the scheduled job.
        # In particular, do not re-label an archived KW42 as current KW43.
        raise RuntimeError("Current official DBV Excel not verified; refusing stale archive; no data changed")
    year,week,_,rows=live[:4]
    return build_payload(rows,year,week)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--publish",action="store_true",help="Requires signed main-branch GitHub OIDC")
    args=parser.parse_args()
    if not args.publish:
        parser.error("Importer is only callable through an explicit --publish")
    # Retrieve the OIDC identity before downloading personal source rows.
    token=request_oidc_token()
    body=produce()
    publish(body,token)

if __name__=="__main__":
    main()
