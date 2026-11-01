#!/usr/bin/env python3
"""Read-only official DBV calendar ingestion. No player registrations are inferred."""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode,urljoin,urlsplit
from urllib.request import Request, urlopen

ORIGIN="https://turniere.badminton.de/"
AGE=("U9","U11","U13","U15","U17","U19","U22","O19","O35ff.")
# IDs were taken from the published DBV calendar's filter URL, not guessed levels.
CATEGORIES=(79,80,81,82,83,84,85,86,87,88,89,91,92,93,94,95,97,98,100,102,103,104,106,107,108)
STATE_ASSOCIATIONS={"Baden-Württemberg","Bayern","Bremen","Hamburg","Hessen","Mecklenburg-Vorpommern",
 "Niedersachsen","Nordrhein-Westfalen","Saarland","Sachsen","Sachsen-Anhalt","Schleswig-Holstein","Thüringen"}
GROUPS={"Gruppe Nord","Gruppe West","Gruppe Mitte","Gruppe Süd-Ost"}
def calendar_url(year=None):
 qs=[("agegroup[]",x) for x in ("U9","U11","U13","U15","U17","U19","U22","O19","O35")]
 qs += [("category[]",str(x)) for x in CATEGORIES]
 qs += [("federation[]",str(i)) for i in range(70,93)]
 qs += [("discipline[]",x) for x in ("Einzel","Doppel","Mixed")]
 qs += [("form[search]","1"),("jws","0"),("remaining","remaining")]
 if year is not None:qs.append(("year",str(year)))
 return ORIGIN+"?"+urlencode(qs)

# Direct tournament UUIDs are obtained ONLY from the exact official calendar
# row / expanded detail panel; no title, date or city matching is allowed.
TOURNAMENT_PATH=re.compile(r"^/tournament/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$",re.I)
CALENDAR_PANEL=re.compile(r"collapse(\d{2,12})$")
DIRECT_HOSTS={"dbv.turnier.de","turnier.de","www.turnier.de"}

def canonical_event_url(link):
 try:
  absolute=urlsplit(urljoin(ORIGIN,str(link).strip()))
  if absolute.scheme!="https" or absolute.hostname not in DIRECT_HOSTS or \
     absolute.username or absolute.password or absolute.port not in (None,443):
   return None
  found=TOURNAMENT_PATH.fullmatch(absolute.path)
  if not found:return None
  return "https://dbv.turnier.de/tournament/"+found.group(1).upper()
 except (ValueError,TypeError):return None

class TableRows(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True)
  self.rows=[];self.row=None;self.cell=None
  self.panels={};self.panel_id=None;self.panel_tag=None;self.panel_depth=0
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if self.panel_id is not None and tag==self.panel_tag:self.panel_depth+=1
  if self.panel_id is None and tag in ("div","tr","section","article"):
   marker=CALENDAR_PANEL.fullmatch(attrs.get("id",""))
   number=marker.group(1) if marker else attrs.get("data-tournament","")
   if re.fullmatch(r"\d{2,12}",str(number)):
    self.panel_id=str(number);self.panel_tag=tag;self.panel_depth=1
    self.panels.setdefault(self.panel_id,[])
  if tag=="tr":
   target=attrs.get("data-target","")
   if re.fullmatch(r"#collapse\d{2,12}",target):
    self.row={"id":target[9:],"columns":[],"links":[]}
  elif tag=="td" and self.row is not None:self.cell=[]
  elif tag=="br" and self.cell is not None:self.cell.append(" ")
  elif tag=="a":
   href=attrs.get("href","")
   if self.row is not None:self.row["links"].append(href)
   if self.panel_id is not None:self.panels[self.panel_id].append(href)
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag=="td" and self.cell is not None and self.row is not None:
   self.row["columns"].append(" ".join("".join(self.cell).split()));self.cell=None
  if tag=="tr" and self.row is not None:
   self.rows.append(self.row);self.row=None;self.cell=None
  if self.panel_id is not None and tag==self.panel_tag:
   self.panel_depth-=1
   if not self.panel_depth:self.panel_id=None;self.panel_tag=None

def verified_detail_link(entry):
 links={link for link in (canonical_event_url(value) for value in entry.get("links",[])) if link}
 # Two distinct tournament UUIDs in the same calendar detail are ambiguous:
 # never silently pick the first.
 return next(iter(links)) if len(links)==1 else None

def read_page(url):
 req=Request(url,headers={"User-Agent":"Schmetterlinge-PublicDBVCalendar/1.0 (+https://github.com/metzgerhannes-oss/Badminton)","Accept":"text/html"})
 with urlopen(req,timeout=25) as resp:
  if resp.status!=200:raise RuntimeError("DBV calendar HTTP "+str(resp.status))
  if resp.url.split("/")[2]!="turniere.badminton.de":raise RuntimeError("Unexpected calendar redirect")
  body=resp.read(3_000_001)
  if len(body)>3_000_000:raise RuntimeError("DBV calendar response unexpectedly large")
  return body.decode("utf-8","replace")

def date_pair(label,year):
 m=re.fullmatch(r"\s*(\d{1,2})\.(\d{2})\.\s*-\s*(\d{1,2})\.(\d{2})\.\s*",label)
 if not m:raise ValueError("Unexpected DBV calendar date: "+label[:90])
 d1,m1,d2,m2=map(int,m.groups())
 start=dt.date(year,m1,d1)
 # December -> January crossover.
 end=dt.date(year+(1 if m2<m1 else 0),m2,d2)
 # The official 2027 DBV source includes series with multi-month published date spans.
 # Keep that source range without inventing individual tournament days.
 if end<start or (end-start).days>366:raise ValueError("Unexpected DBV date interval")
 return start.isoformat(),end.isoformat()

def normalize(entry,year):
 cells=entry["columns"]
 if len(cells)!=8:raise ValueError("Unexpected DBV table column count")
 dates,name,place,organizer,category,age_text,deadline,_=cells
 try:
  start,end=date_pair(dates,year)
 except ValueError as error:
  raise ValueError(f"DBV calendar {year} ID {entry['id']} {name[:80]!r}: {dates!r}: {error}") from error
 ages=sorted(set(re.findall(r"U(?:9|11|13|15|17|19|22)|O19|O35(?:ff\.)?",age_text,re.I)),key=lambda a:AGE.index("O35ff." if a.startswith("O35") else a.upper()) if ("O35ff." if a.startswith("O35") else a.upper()) in AGE else 99)
 ages=["O35ff." if a.startswith("O35") else a.upper() for a in ages]
 disciplines=[d for d in ("Einzel","Doppel","Mixed") if re.search(r"\b"+{"Einzel":"E","Doppel":"D","Mixed":"M"}[d]+r"\b",age_text)]
 category=category.strip()
 level=re.match(r"^([A-E])(?:[12])?-Level\b",category,re.I)
 group=level.group(1).upper() if level else "Freizeit" if "freizeit" in category.lower() else "International" if organizer in ("Badminton Europe","BWF") or any(x in category for x in ("BWF","BEC","International","Series","Tour","Championship")) else "Sonstige"
 if not name or not organizer or not category or not ages:raise ValueError("Unusable DBV calendar row "+str(entry["id"]))
 deadline_iso=None
 if deadline:
  try:deadline_iso=dt.datetime.strptime(deadline,"%d.%m.%Y").date().isoformat()
  except ValueError:raise ValueError("Invalid DBV registration deadline")
 if organizer in STATE_ASSOCIATIONS:region=organizer;scope="state"
 elif organizer in GROUPS:region=None;scope="group"
 elif organizer in ("DBV",):region=None;scope="national"
 elif organizer in ("BWF","Badminton Europe"):region=None;scope="international"
 else:region=None;scope="association"
 return {"source_key":"dbv-calendar-"+str(entry["id"]),"title":name[:240],"start_date":start,
  "end_date":end,"location_text":place[:180],"organizer":organizer[:100],"bundesland":region,
  "region_scope":scope,"category":category[:100],"level_group":group,
  "age_groups":ages,"disciplines":disciplines,"registration_deadline":deadline_iso,
  "event_url":verified_detail_link(entry),"source_url":ORIGIN}

def parse_page(html,year):
 if "tournamenttable" not in html or "Turniere gefunden" not in html:raise ValueError("Calendar table missing")
 match=re.search(r"(\d+)\s+Turniere gefunden",html)
 if not match:raise ValueError("Official result counter missing")
 expected=int(match.group(1))
 rows=TableRows();rows.feed(html)
 if len(rows.rows)!=expected:raise ValueError(f"Source mismatch: calendar announces {expected}, parser read {len(rows.rows)}")
 for row in rows.rows:
  row["links"].extend(rows.panels.get(row["id"],[]))
 clean=[normalize(row,year) for row in rows.rows]
 if len({r["source_key"] for r in clean})!=len(clean):raise ValueError("Duplicated official calendar IDs")
 return clean

def write_snapshot(rows,path):
 now=dt.datetime.now(dt.timezone.utc)
 if path.exists():
  try:
   previous=json.loads(path.read_text(encoding="utf-8"))
   at=dt.datetime.fromisoformat(previous["capturedAt"].replace("Z","+00:00"))
   if previous.get("entries")==rows and (now-at).days<7:
    print("DBV calendar snapshot unchanged; no new publish needed",flush=True)
    return
  except (ValueError,KeyError,TypeError):pass
 output={"schemaVersion":1,"source":ORIGIN,"capturedAt":now.isoformat(),
  "scope":"remaining-current-and-next-year","entries":rows}
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main():
 cli=argparse.ArgumentParser()
 cli.add_argument("--write-json",action="store_true")
 cli.add_argument("--export-payload",type=Path,default=None)
 cli.add_argument("--emit-lines",action="store_true")
 cli.add_argument("--year",type=int,default=dt.datetime.now().year)
 cli.add_argument("--fixture",type=Path,default=None)
 args=cli.parse_args()
 if args.year<2025 or args.year>2100:raise ValueError("Year out of bounds")
 url=calendar_url(args.year)
 text=args.fixture.read_text(encoding="utf-8") if args.fixture else read_page(url)
 rows=parse_page(text,args.year)
 if not rows:raise RuntimeError("Empty calendar is not a valid replacement")
 if args.fixture is None:
  # The DBV lists 2027 already. A malformed year must fail rather than be
  # silently omitted from the published calendar.
  next_year=args.year+1
  future=read_page(calendar_url(next_year))
  if re.search(r"\\b0\\s+Turniere gefunden\\b",future) and "tournamenttable" not in future:
   print(f"DBV {next_year}: no official calendar entries published yet",flush=True)
  else:
   next_rows=parse_page(future,next_year)
   if not next_rows:raise RuntimeError(f"DBV {next_year} returned an unexpectedly empty calendar")
   rows.extend(next_rows)
   print(f"DBV {next_year}: {len(next_rows)} source-verified entries",flush=True)
  if len({x["source_key"] for x in rows})!=len(rows):
   raise ValueError("Duplicate event ID across DBV year windows")
 print(f"DBV calendar: {len(rows)} verified entries, first {rows[0]['start_date']}",flush=True)
 if args.emit_lines:
  for x in rows:print("DBV_CALENDAR_ENTRY "+json.dumps(x,ensure_ascii=False,separators=(",",":")))
 if args.write_json:write_snapshot(rows,Path("data/dbv-calendar.json"))
 if args.export_payload:
  args.export_payload.write_text(json.dumps({"expectedCount":len(rows),"entries":rows},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")

if __name__=="__main__":main()
