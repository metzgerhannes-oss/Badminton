#!/usr/bin/env python3
"""Manually approve a report candidate after verifying the original article.

This is deliberately not run by the scheduled source discovery.
"""
import argparse
from datetime import date
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

def main():
    parser=argparse.ArgumentParser(description="Approve checked report metadata for the public app")
    parser.add_argument('--url',required=True,help='Exact URL from data/report-pending.json')
    parser.add_argument('--players',nargs='*',default=[],help='Verified DBV player IDs in article body')
    parser.add_argument('--club-only',action='store_true',help='No personal mention; a club report only')
    parser.add_argument('--confirm-original',action='store_true',help='I have read the original article and verified title, URL and names')
    parser.add_argument('--published-on',default=None,help='Optional confirmed publication date YYYY-MM-DD')
    parser.add_argument('--root',type=Path,default=Path('.'))
    args=parser.parse_args()
    if not args.confirm_original:parser.error('--confirm-original is required')
    if args.club_only == bool(args.players):parser.error('Choose exactly one of --players or --club-only')
    if any(not re.fullmatch(r'\d{2}-\d{6}',p) for p in args.players):parser.error('Invalid DBV player ID')
    if args.published_on:
        try:date.fromisoformat(args.published_on)
        except ValueError:parser.error('Invalid date')
    queue_file=args.root/'data/report-pending.json'
    articles_file=args.root/'data/report-articles.json'
    sources_file=args.root/'data/report-sources.json'
    queue=json.loads(queue_file.read_text(encoding='utf-8'))
    data=json.loads(articles_file.read_text(encoding='utf-8'))
    sources=json.loads(sources_file.read_text(encoding='utf-8'))
    match=next((a for a in queue['candidates'] if a['url']==args.url),None)
    if match is None:parser.error('URL not in candidate queue')
    if args.players and not set(args.players).issubset(set(match.get('players',[]))):
        parser.error('Requested player IDs were not detected; manually review the original and correct the candidate first')
    if args.club_only and not match.get('club_context'):
        parser.error('No club context detected; review and correct evidence manually')
    if match['source'] not in {a['id'] for a in sources['sources']}:
        parser.error('Unknown source')
    if any(a['url']==args.url for a in data['articles']):
        parser.error('Already approved')
    if urlsplit(args.url).scheme!='https':parser.error('Not HTTPS')
    data['articles'].append({
        'source':match['source'],'date':args.published_on or match.get('date'),
        'title':match['title'],'url':match['url'],
        'summary':'Namentliche Erwähnung im Originalartikel bestätigt.' if args.players else 'Bericht mit Bezug zur SpVgg Mössingen.',
        'players':sorted(set(args.players)),
        'note':'Originalartikel durch Redaktion geprüft',
        'status':'verified',
        'club_id':'spvgg-moessingen',
        'checked_at':date.today().isoformat()
    })
    queue['candidates']=[x for x in queue['candidates'] if x['url']!=args.url]
    data['articles'].sort(key=lambda a:(a.get('date') or '',a['url']),reverse=True)
    articles_file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    queue_file.write_text(json.dumps(queue,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Approved one report link and removed it from unpublished review queue.')

if __name__=='__main__':
    main()
