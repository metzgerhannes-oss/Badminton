#!/usr/bin/env python3
"""Bounded official club team-report link importer.

Only neutral metadata about verified club-origin articles is published to the
repository. No names, article bodies, scorelines or inferred player achievements.
"""
from __future__ import annotations
from datetime import date
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

DISCOVERY = Path(__file__).with_name("discover-reports.py")
spec = importlib.util.spec_from_file_location("report_discovery", DISCOVERY)
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

CLUB = "spvgg-moessingen"
SOURCE = "club-moessingen"
PAGE_LIMIT = 6
LINK_LIMIT = 35
MAX_RECORDS = 160
INDEX_PATTERN = re.compile(r"^https://www[.]spvgg[.]org/abteilungen/badminton/aktuelles$")
TEAM = re.compile(r"\b(?:mannschaft(?:en|s|smeisterschaft)?|team(?:s)?|spieltag|punktspiel(?:e)?|"
                  r"regionalliga|verbandsliga|oberliga|bezirksliga|landesliga|kreisliga|"
                  r"rundenspiel(?:e)?|heimspiel(?:e)?|ausw[aä]rtsspiel(?:e)?|"
                  r"saisonauftakt|saisonabschluss|liga-?betrieb)\b", re.I)
MATCH = re.compile(r"\b(?:spiel(?:en|te|ten|tag|tags|s|e)?|begegnung(?:en)?|"
                   r"gewann|gewonnen|verlor|verloren|sieg(?:e)?|niederlage(?:n)?|"
                   r"saison|gruppe|runde|turnier|kampf|aufstieg|abstieg|meisterschaft)\b", re.I)
CLUB_NAME = re.compile(r"\b(?:spvgg[.]?\s*m[öo]ssingen|sportvereinigung\s*m[öo]ssingen|"
                       r"m[öo]ssinger\s+(?:team|mannschaft))\b", re.I)

def valid_link(url, monitor):
    return source.article_allowed(url, monitor) and len(url) <= 450

def qualifies(article_html):
    page = source.parse(article_html)
    body = page.article_text()
    if len(body) < 100:
        return False, None
    title = page.headline()
    if not CLUB_NAME.search(body):
        return False, None
    evidence = title + " " + body
    if not TEAM.search(evidence) or not MATCH.search(evidence):
        return False, None
    return True, page.published()

def normalized_record(raw, monitor):
    if not isinstance(raw, dict) or not isinstance(raw.get("url"), str):
        return None
    url = source.canonical(raw["url"])
    if not valid_link(url, monitor) or raw.get("club_id") != CLUB or raw.get("source_id") != SOURCE:
        return None
    day = raw.get("published_on")
    if day is not None:
        try:
            if not isinstance(day, str): return None
            date.fromisoformat(day)
        except ValueError: return None
    return {"source_id": SOURCE, "club_id": CLUB, "url": url,
            "title": "Mannschaftsbericht der SpVgg Mössingen",
            "published_on": day}

def scan(root: Path, *, fetcher=source.fetch, robots=source.robots_allowed,
         sleeper=time.sleep, today=None):
    today = today or date.today().isoformat()
    registry = json.loads((root / "data/report-sources.json").read_text(encoding="utf-8"))
    allowed = next((s for s in registry["sources"] if s.get("id") == SOURCE
                    and s.get("verification_status") == "verified"
                    and s.get("monitor", {}).get("enabled")), None)
    if allowed is None:
        raise RuntimeError("Verified official club monitor is not enabled")
    monitor = allowed["monitor"]
    original_index = monitor["index_url"]
    if not INDEX_PATTERN.fullmatch(original_index):
        raise RuntimeError("Only the pinned official club URL may be imported")
    target = root / "data/team-report-links.json"
    previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {"reports": []}
    previous_items = [r for raw in previous.get("reports", [])
                      if (r := normalized_record(raw, monitor)) is not None]
    collected = {source.key(r["url"]): r for r in previous_items}
    inspected, index_ok, rejected, fetch_failures = 0, 0, 0, 0
    urls = set()
    for page_idx in range(PAGE_LIMIT):
        listing = original_index + ("?start=" + str(page_idx * 5) if page_idx else "")
        if not robots(listing):
            if page_idx == 0:
                raise RuntimeError("Official club blocks source access")
            break
        try:
            final, html = fetcher(listing)
            if not INDEX_PATTERN.fullmatch(final):
                raise RuntimeError("Unexpected club listing redirect")
            index_ok += 1
            for href in source.parse(html).links:
                url = source.canonical(urljoin(final, href))
                if valid_link(url, monitor) and source.key(url) not in collected:
                    urls.add(url)
                if len(urls) >= LINK_LIMIT: break
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            fetch_failures += 1
            if page_idx == 0: raise RuntimeError("Primary official club source unavailable")
        if len(urls) >= LINK_LIMIT: break
    if index_ok == 0: raise RuntimeError("No official club index checked")
    for url in sorted(urls)[:LINK_LIMIT]:
        if not robots(url): continue
        try:
            sleeper(0.25)
            final, html = fetcher(url)
            if not valid_link(final, monitor): raise ValueError("Unknown article redirect")
            inspected += 1
            accepted, published_on = qualifies(html)
            if not accepted:
                rejected += 1
                continue
            record = {"source_id": SOURCE, "club_id": CLUB,
                      "url": source.canonical(final),
                      "title": "Mannschaftsbericht der SpVgg Mössingen",
                      "published_on": published_on}
            collected[source.key(final)] = record
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            fetch_failures += 1
    if urls and inspected == 0 and not previous_items:
        raise RuntimeError("No official articles could be checked; do not publish empty feed")
    reports = sorted(collected.values(), key=lambda r:(r["published_on"] or "",r["url"]), reverse=True)[:MAX_RECORDS]
    feed = {"schemaVersion": 1, "sourceKind": "verified_official_team_report_links",
            "checkedOn": today, "reports": reports}
    target.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"listings": index_ok, "inspected": inspected, "accepted": len(reports)-len(previous_items),
            "rejected": rejected, "networkFailures": fetch_failures, "stored": len(reports)}

if __name__ == "__main__":
    import argparse
    argp = argparse.ArgumentParser()
    argp.add_argument("--root", type=Path, default=Path("."))
    args = argp.parse_args()
    result = scan(args.root)
    print("Official club team-report link scan:", json.dumps(result, sort_keys=True))
    if result["networkFailures"]:
        print("WARN: temporary source errors; existing report links kept", file=sys.stderr)
