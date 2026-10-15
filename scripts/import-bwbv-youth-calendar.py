#!/usr/bin/env python3
"""Public, read-only BWBV youth planning and DBV BW host awards.

Extract only source-verified planning rows; never invent event IDs, venues,
registration opportunities or player participation. Snapshot remains usable
during temporary source outages; a changed/unreadable upstream fails the run.
"""
import argparse
import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"bwbv-youth-framework-2027.json"
BWBV="https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"
DBV="https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"
C_YOUTH=["U13","U15","U17","U19"]
ALL_YOUTH=["U11",*C_YOUTH]

def iso_pair(day1,day2,month,year):
    start=dt.date(int(year),int(month),int(day1))
    end=dt.date(int(year),int(month),int(day2))
    if end<start or (end-start).days>3:raise ValueError("Invalid planning date span")
    return start.isoformat(),end.isoformat()

def source_entry(key,title,level,start,end,ages,source,age_certain=False,organizer=""):
    return {"key":key,"title":title,"level":level,"start":start,"end":end,
            "ages":ages,"ageCertain":age_certain,"status":"planned",
            "source":source,"organizer":organizer}

def extract_bwbv(text):
    normalized=" ".join(text.replace("\u00ad","").replace("\ufeff","").split())
    pattern=(r"(?<!\d)(\d{1,2})\s*\./\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(2027)"
             r"\s+([1-4])\.\s*BWBV\s*/\s*C-RLT")
    rows={}
    for d1,d2,month,year,no in re.findall(pattern,normalized,re.I):
        start,end=iso_pair(d1,d2,month,year)
        if no in rows:raise ValueError("Duplicate C-level rank in official BWBV plan")
        ages=ALL_YOUTH if no in ("1","3") else C_YOUTH
        suffix={"1":"Einzel/Doppel","2":"Einzel/Mixed",
                "3":"Einzel/Doppel","4":"Hexen-Cup"}[no]
        rows[no]=source_entry("bwbv-2027-c-"+no,
            no+". BWBV/C-RLT Jugend · "+suffix,"C",start,end,
            list(ages),BWBV,False)
    if set(rows)!={"1","2","3","4"}:
        raise ValueError("BWBV publication missing the four individually dated 2027 C-RLT rows")
    # The group schedule explicitly identifies Baden-Württemberg and U13-U19.
    p=(r"(?<!\d)(\d{1,2})\s*\./\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(2027)"
       r"\s+3\.\s*B-RLT\s+U13\s*[-–]\s*U19\s+BAW")
    bs=re.findall(p,normalized,re.I)
    if len(bs)!=1:raise ValueError("BWBV 3. B-RLT U13-U19 BAW date missing/ambiguous")
    start,end=iso_pair(*bs[0])
    rows["B"]=source_entry("bwbv-2027-b-3","3. B-RLT SüdOst U13–U19",
         "B",start,end,list(C_YOUTH),BWBV,True)
    return list(rows.values())

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[]
    def handle_data(self,data):
        self.parts.append(data)

def extract_dbv_awards(html):
    p=TextParser();p.feed(html)
    text=" ".join(" ".join(p.parts).replace("\xa0"," ").split())
    matches={}
    # Only two explicitly awarded hosts in Baden-Württemberg. Do not treat
    # national A-RLT dates as BW tournaments without a BW host.
    for no,organizer,key in [
      (2,"BC Lörrach-Brombach","dbv-bw-a-2027-2"),
      (4,"BSV Eggenstein","dbv-bw-a-2027-4"),
    ]:
        rx=(rf"\b{no}\.\s*A-RLT\s+U11\s*/\s*U13\s+"
            +re.escape(organizer)+r"\s+(\d{1,2})\s*\./\s*(\d{1,2})\s*\.\s*(\d{2})\s*\.\s*(2027)")
        match=re.search(rx,text,re.I)
        if not match:raise ValueError("DBV host/date not confirmed: "+organizer)
        start,end=iso_pair(*match.groups())
        matches[key]=source_entry(key,str(no)+". A-RLT U11/U13 · "+organizer,
          "A",start,end,["U11","U13"],DBV,True,organizer)
    return list(matches.values())

def read_url(url,max_bytes):
    host=url.split("/")[2]
    if host not in ("bwbv.de","www.badminton.de"):raise ValueError("Unexpected official host")
    req=Request(url,headers={"User-Agent":"Schmetterlinge-YouthCalendar/1.0 (+https://github.com/metzgerhannes-oss/Badminton)",
                             "Accept":"application/pdf,text/html"})
    with urlopen(req,timeout=35) as response:
        if response.status!=200 or response.url.split("/")[2]!=host:
            raise RuntimeError("Official source fetch or redirect failed")
        payload=response.read(max_bytes+1)
        if len(payload)>max_bytes:raise RuntimeError("Official source too large")
        return payload

def pdf_text(blob):
    if not blob.startswith(b"%PDF-"):raise RuntimeError("Expected an official PDF")
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder)/"publication.pdf"
        path.write_bytes(blob)
        result=subprocess.run(["pdftotext","-layout",str(path),"-"],
           capture_output=True,text=True,timeout=25,check=True)
    if "Termine 2026/2027" not in result.stdout:
        raise RuntimeError("Unexpected BWBV plan edition")
    return result.stdout

def make_snapshot(bwbv_text,dbv_html):
    rows=extract_bwbv(bwbv_text)+extract_dbv_awards(dbv_html)
    ids=[x["key"] for x in rows]
    if len(rows)!=7 or len(ids)!=len(set(ids)):
        raise ValueError("2027 BWBV/DBV source row-count mismatch")
    rows.sort(key=lambda x:(x["start"],x["level"],x["key"]))
    return {"schemaVersion":1,"scope":"bw-youth-abc-planning-2027",
            "year":2027,"sourceFamilies":[BWBV,DBV],"entries":rows}

def write_snapshot(data,path=OUT):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        try:
            old=json.loads(path.read_text(encoding="utf-8"))
            if all(old.get(k)==data[k] for k in
                  ("schemaVersion","scope","year","sourceFamilies","entries")):
                print("BWBV/DBV youth planning unchanged",flush=True)
                return
        except (ValueError,TypeError,KeyError):pass
    data["capturedAt"]=dt.datetime.now(dt.timezone.utc).isoformat()
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument("--write-json",action="store_true")
    cli.add_argument("--fixture-pdf-text",type=Path)
    cli.add_argument("--fixture-dbv-html",type=Path)
    args=cli.parse_args()
    bwbv_text=args.fixture_pdf_text.read_text(encoding="utf-8") if args.fixture_pdf_text else pdf_text(read_url(BWBV,7_000_000))
    dbv_html=args.fixture_dbv_html.read_text(encoding="utf-8") if args.fixture_dbv_html else read_url(DBV,2_000_000).decode("utf-8","replace")
    snapshot=make_snapshot(bwbv_text,dbv_html)
    print("Source-verified BW youth planning:",len(snapshot["entries"]),
          "2027 rows: A=2, B=1, C=4",flush=True)
    if args.write_json:write_snapshot(snapshot)

if __name__=="__main__":main()
