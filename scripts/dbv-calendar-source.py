#!/usr/bin/env python3
"""Read-only diagnostics for the official public DBV tournament calendar."""
import argparse
import re
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urlencode

BASE = "https://turniere.badminton.de/"
FILTER_PARAMS = {"agegroup[]":["U9","U11","U13","U15","U17","U19","U22","O19","O35"],"category[]":[str(i) for i in [79,80,81,82,83,84,85,86,87,88,89,91,92,93,94,95,97,98,100,102,103,104,106,107]],"federation[]":[str(i) for i in range(70,93)],"discipline[]":["Einzel","Doppel","Mixed"],"form[search]":"1","remaining":"remaining","jws":"0"}
URLS = [
 BASE,
 BASE + "?form%5Bsearch%5D=1&year=2026&remaining=remaining",
 BASE + "?form%5Bsearch%5D=1&year=2027&remaining=remaining",
 BASE + "?" + urlencode(FILTER_PARAMS,doseq=True),
 BASE + "?agegroup%5B%5D=U11&agegroup%5B%5D=U13&agegroup%5B%5D=U15&agegroup%5B%5D=U17&agegroup%5B%5D=U19&category%5B%5D=79&category%5B%5D=80&category%5B%5D=81&category%5B%5D=82&category%5B%5D=83&category%5B%5D=84&category%5B%5D=85&category%5B%5D=86&federation%5B%5D=88&form%5Bsearch%5D=1&jws=0&remaining=remaining",
]

class StructuralProbe(HTMLParser):
 def __init__(self):
  super().__init__()
  self.rows=[];self.row=None;self.cell=None;self.anchor=None;self.links=[]
 def handle_starttag(self, tag, attrs):
  a=dict(attrs)
  if tag=="tr":self.row=[]
  if tag in ("td","th") and self.row is not None:self.cell=[]
  if tag=="a" and self.row is not None:self.anchor=a.get("href")
  if tag=="a" and a.get("href") and ("export" in a["href"] or "csv" in a["href"] or "ics" in a["href"]):self.links.append(a["href"])
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ("td","th") and self.cell is not None and self.row is not None:
   self.row.append(" ".join(" ".join(self.cell).split())[:160]);self.cell=None
  if tag=="tr" and self.row is not None:
   if self.row:self.rows.append(self.row)
   self.row=None
  if tag=="a":self.anchor=None

def request(url):
 req=Request(url,headers={"User-Agent":"Schmetterlinge-DBV-Calendar-Reader/1.0 (+https://github.com/metzgerhannes-oss/Badminton; low frequency)","Accept":"text/html"})
 with urlopen(req,timeout=20) as r:return r.status,r.url,r.read(2_500_000).decode("utf-8","replace")

def inspect():
 for url in URLS:
  try:
   code,final,body=request(url)
   probe=StructuralProbe();probe.feed(body)
   print("URL",url,"HTTP",code,"FINAL",final,"bytes",len(body),"tr_count",len(probe.rows))
   print("ROWS",repr(probe.rows[:4]))
   tag=body.find("<table");print("TABLE_FRAGMENT",re.sub(r"\\s+"," ",body[tag:tag+6600])[:6600] if tag>=0 else "NONE")
   m=re.search(r'<tr[^>]*>\\s*<td[^>]*>[\\s\\S]{0,6000}?</tr>',body,re.I)
   print("FIRST_DATA_TR",re.sub(r"\\s+"," ",m.group(0))[:4800] if m else "NONE")
   for pattern in (r'<form[^>]*>',r'<select[^>]*name="year"[^>]*>[\\s\\S]{0,700}?</select>',r'<input[^>]*(?:name="federation|name="category|name="agegroup)[^>]*>',r"(?s).{0,240}downloadTournaments.{0,900}"):
    hit=re.search(pattern,body,re.I)
    print("STRUCT",pattern[:40],re.sub(r"\\s+"," ",hit.group(0))[:950] if hit else "none")
   print("EXTRA_LINKS",repr(probe.links[:8]))
   for term in ("Download Liste","In Kalender importieren","Turniere gefunden","<table","tournament/"):
    print("MARK",term,"count",body.count(term),"excerpt",re.sub(r"\s+"," ",body[max(0,body.find(term)-150):body.find(term)+280])[:430] if term in body else "")
  except Exception as e:print("FETCH ERROR",str(e)[:400])

if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("--inspect",action="store_true");a=parser.parse_args()
 if a.inspect:inspect()
