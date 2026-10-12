#!/usr/bin/env python3
"""Publish source-verified DBV calendar rows through GitHub OIDC (no stored DB secret)."""
import argparse
import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

AUDIENCE="schmetterlinge-dbv-calendar-yadexibmjmnjfmfabrug"
FUNCTION="https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/dbv-calendar-publish"
REPOSITORY="metzgerhannes-oss/Badminton"

def request_oidc_token(env=os.environ):
 if env.get("GITHUB_REPOSITORY")!=REPOSITORY or env.get("GITHUB_REF")!="refs/heads/main":
  raise RuntimeError("Only the repository main workflow can publish calendar rows")
 url=env.get("ACTIONS_ID_TOKEN_REQUEST_URL","")
 bearer=env.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN","")
 if not url.startswith("https://") or not bearer:
  raise RuntimeError("Missing GitHub OIDC runtime permissions (id-token: write)")
 delim="&" if "?" in url else "?"
 request=Request(url+delim+"audience="+quote(AUDIENCE,safe=""),
  headers={"Authorization":"bearer "+bearer,"Accept":"application/json"})
 with urlopen(request,timeout=15) as res:
  if res.status!=200:raise RuntimeError("Cannot obtain GitHub OIDC identity")
  token=json.load(res).get("value","")
 if not isinstance(token,str) or len(token)<200 or len(token)>10000:
  raise RuntimeError("GitHub OIDC identity missing or malformed")
 return token

def send(payload,token):
 if not isinstance(payload,dict) or not isinstance(payload.get("entries"),list):
  raise RuntimeError("Calendar rows missing")
 if payload.get("expectedCount")!=len(payload["entries"]) or not payload["entries"]:
  raise RuntimeError("Calendar row count mismatch")
 body=json.dumps(payload,separators=(",",":"),ensure_ascii=False).encode("utf-8")
 if len(body)>600000:raise RuntimeError("Payload too large for the restricted writer")
 req=Request(FUNCTION,method="POST",data=body,headers={
  "Authorization":"Bearer "+token,"Content-Type":"application/json",
  "Accept":"application/json"
 })
 try:
  with urlopen(req,timeout=65) as res:
   reply=json.load(res)
   if res.status!=200 or reply.get("ok") is not True or reply.get("count")!=len(payload["entries"]):
    raise RuntimeError("Supabase calendar writer did not confirm all rows")
 except HTTPError as error:
  raise RuntimeError("Supabase calendar writer HTTP "+str(error.code)) from None
 except URLError as error:
  raise RuntimeError("Supabase calendar writer unreachable") from None
 print("DBV calendar Supabase OIDC upsert verified:",reply["count"],"rows",flush=True)

def main():
 cli=argparse.ArgumentParser()
 cli.add_argument("--payload",type=Path,required=True)
 args=cli.parse_args()
 payload=json.loads(args.payload.read_text(encoding="utf-8"))
 token=request_oidc_token()
 send(payload,token)

if __name__=="__main__":main()
