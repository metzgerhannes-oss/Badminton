#!/usr/bin/env python3
"""Review-only source watcher. Does NOT publish an article or reproduce article text."""
from __future__ import annotations
import argparse
from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

USER_AGENT = 'SchmetterlingeReportMonitor/1.0 (+https://github.com/metzgerhannes-oss/Badminton)'
MAX_BYTES = 1_000_000
MAX_LINKS_PER_SOURCE = 45
MAX_PENDING = 500
MAX_MONITORED = 60
REST_ROOT = 'https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/'
REST_KEY = 'sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE'
DBV_ID = re.compile(r'\d{2}-\d{6}')
NAMES = {
    '05-070879': re.compile(r'(?<!\w)Philipp\s+Metzger(?!\w)', re.I),
    '05-071969': re.compile(r'(?<!\w)Charlotte\s+Metzger(?!\w)', re.I),
}
def read_public_register(path, opener=urlopen):
    """Read only already public Supabase rows; do not access private follows."""
    request = Request(REST_ROOT + path, headers={
        'apikey': REST_KEY, 'Accept': 'application/json',
        'User-Agent': USER_AGENT
    })
    with opener(request, timeout=14) as response:
        payload = response.read(100001)
    if len(payload) > 100000:
        raise ValueError('Registry response too large')
    result = json.loads(payload.decode('utf-8'))
    if not isinstance(result, list):
        raise ValueError('Registry did not return a list')
    return result


def registered_patterns(getter=read_public_register):
    """Names only for history-import requests, never full DBV library."""
    names = dict(NAMES)
    try:
        requests = getter('player_history_imports?select=dbv_id&order=dbv_id&limit=61')
        ids = sorted({row['dbv_id'] for row in requests
                      if isinstance(row, dict) and isinstance(row.get('dbv_id'), str)
                      and DBV_ID.fullmatch(row['dbv_id'])})
        if len(ids) > MAX_MONITORED:
            print('WARN: public queue exceeded 60 profiles; capped', file=sys.stderr)
        ids = ids[:MAX_MONITORED]
        if not ids:
            return names
        players = getter('players?select=dbv_id,name&dbv_id=in.(' + ','.join(ids) + ')')
        for row in players:
            if not isinstance(row, dict) or row.get('dbv_id') not in ids:
                continue
            name = row.get('name')
            if not isinstance(name, str):
                continue
            name = ' '.join(name.strip().split())
            if len(name.split()) < 2 or not 5 <= len(name) <= 90:
                continue
            if not all(c.isalpha() or c in " -'.’" for c in name):
                continue
            expr = r'(?<!\w)' + r'\s+'.join(re.escape(w) for w in name.split()) + r'(?!\w)'
            names[row['dbv_id']] = re.compile(expr, re.I)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError,
            KeyError, TypeError) as error:
        print('Public import registry unavailable (fallback to known profiles): ' +
              type(error).__name__, file=sys.stderr)
    return names


CLUB = re.compile(r'\b(?:spvgg\.?\s+m[öo]ssingen|sportvereinigung\s+m[öo]ssingen)\b', re.I)
SKIP_TAGS = {'script','style','noscript','svg','form','nav','header','footer','aside'}
VOID_TAGS = {'meta','link','img','br','hr','input','source','area','base','embed','wbr'}
# Strict post-content containers. Never search broad <main> or <article> wrappers:
# WordPress related-post cards can contain names from unrelated stories.
CONTENT_CLASSES = {'entry-content','post-content','elementor-widget-theme-post-content',
                   'elementor-widget-post-content','td-post-content','news-content'}

def canonical(raw):
    try:
        p = urlsplit(raw)
        if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None,443):
            return ''
        if not re.fullmatch(r'[a-z0-9.-]+',p.hostname):
            return ''
        return urlunsplit(('https',p.hostname.lower(),re.sub(r'/{2,}','/',p.path or '/'),'',''))
    except ValueError:
        return ''

def key(url):
    p=urlsplit(canonical(url))
    return urlunsplit((p.scheme,(p.hostname or '').removeprefix('www.'),p.path.rstrip('/') or '/','','')) if p.hostname else ''

def article_allowed(url,monitor):
    value=canonical(url)
    return bool(value and urlsplit(key(value)).hostname==urlsplit(key(monitor['index_url'])).hostname
        and re.fullmatch(monitor['article_path_regex'],urlsplit(value).path)
        and key(value)!=key(monitor['index_url']))

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links=[]
        self.meta={}
        self.h1=[]
        self.title_parts=[]
        self.body=[]
        self.article=[]
        self.main=[]
        self.editorial=[]
        self.editorial_at=0
        self.depth=0
        self.skip_at=0
        self.article_at=0
        self.main_at=0
        self.h1_at=0
        self.title_at=0
        self.times=[]
    def handle_starttag(self,tag,attrs):
        attr=dict(attrs)
        if tag not in VOID_TAGS:
            self.depth+=1
        if self.skip_at:
            return
        if tag in SKIP_TAGS:
            self.skip_at=self.depth
            return
        classes=set(attr.get('class','').split())
        if tag in ('div','section') and (classes & CONTENT_CLASSES) and not self.editorial_at:
            self.editorial_at=self.depth
        if tag=='article' and not self.article_at:self.article_at=self.depth
        if tag=='main' and not self.main_at:self.main_at=self.depth
        if tag=='h1' and not self.h1_at:self.h1_at=self.depth
        if tag=='title' and not self.title_at:self.title_at=self.depth
        if tag=='a' and attr.get('href'):self.links.append(attr['href'])
        if tag=='meta':
            k=attr.get('property') or attr.get('name')
            if k and attr.get('content'):self.meta[k.lower()]=attr['content']
        if tag=='time' and attr.get('datetime'):self.times.append(attr['datetime'])
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID_TAGS:self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if self.skip_at and self.depth==self.skip_at:self.skip_at=0
        if self.editorial_at and self.depth==self.editorial_at:self.editorial_at=0
        if tag=='article' and self.depth==self.article_at:self.article_at=0
        if tag=='main' and self.depth==self.main_at:self.main_at=0
        if tag=='h1' and self.depth==self.h1_at:self.h1_at=0
        if tag=='title' and self.depth==self.title_at:self.title_at=0
        self.depth=max(self.depth-1,0)
    def handle_data(self,s):
        if self.skip_at or not s.strip():return
        if self.editorial_at:self.editorial.append(s)
        if self.article_at:self.article.append(s)
        if self.main_at:self.main.append(s)
        if self.h1_at:self.h1.append(s)
        if self.title_at:self.title_parts.append(s)
    def headline(self):
        return ' '.join(' '.join(self.h1).split()) or self.meta.get('og:title','') or ' '.join(' '.join(self.title_parts).split())
    def published(self):
        for v in [self.meta.get('article:published_time',''),self.meta.get('datepublished',''),*self.times]:
            try:
                if re.fullmatch(r'\d{4}-\d{2}-\d{2}',v[:10]):
                    date.fromisoformat(v[:10])
                    return v[:10]
            except ValueError:pass
        return None
    def article_text(self):
        # Fail closed without an explicit article-body container.
        # In particular, previews below the story in main/article never count.
        return ' '.join(' '.join(self.editorial).split())

def parse(html):
    p=Page()
    p.feed(html)
    p.close()
    return p

def fetch(url, opener=urlopen):
    req=Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'})
    with opener(req,timeout=18) as resp:
        typ=resp.headers.get('Content-Type','').lower()
        if 'text/html' not in typ and 'application/xhtml+xml' not in typ:
            raise ValueError('non-html response')
        if resp.headers.get('Content-Length') and int(resp.headers['Content-Length'])>MAX_BYTES:
            raise ValueError('oversized response')
        payload=resp.read(MAX_BYTES+1)
        if len(payload)>MAX_BYTES:raise ValueError('oversized response')
        charset=resp.headers.get_content_charset() or 'utf-8'
        return canonical(resp.geturl()),payload.decode(charset,errors='replace')

ROBOTS_CACHE={}
def robots_allowed(url,opener=urlopen):
    p=urlsplit(url)
    origin=p.scheme+'://'+p.netloc
    if origin not in ROBOTS_CACHE:
        try:
            with opener(Request(origin+'/robots.txt',headers={'User-Agent':USER_AGENT}),timeout=12) as resp:
                contents=resp.read(200000).decode('utf-8',errors='replace')
            rp=RobotFileParser()
            rp.parse(contents.splitlines())
            ROBOTS_CACHE[origin]=rp
        except HTTPError as e:
            ROBOTS_CACHE[origin]=e.code in (404,410)
        except (URLError,TimeoutError,OSError,ValueError):
            ROBOTS_CACHE[origin]=False
    obj=ROBOTS_CACHE[origin]
    return obj if isinstance(obj,bool) else obj.can_fetch(USER_AGENT,url)

def analyze(url,monitor,html,day,names=None):
    if not article_allowed(url,monitor):return None
    p=parse(html)
    body=p.article_text()
    if len(body)<110:return None
    tracked = NAMES if names is None else names
    matched=[ident for ident,pattern in tracked.items() if pattern.search(body)]
    club=bool(CLUB.search(body))
    if not matched and not club:return None
    headline=p.headline().strip()[:220]
    if len(headline)<10:return None
    return {'url':canonical(url),'source':monitor['source'],'title':headline,
            'date':p.published(),'players':matched,
            'evidence':'explicit-name-in-article-body' if matched else 'club-name-in-article-body',
            'club_context':club,'detected_on':day,'status':'needs-review'}

def discover(monitor,excluded,day,*,fetcher=fetch,robots=robots_allowed,sleeper=time.sleep,names=None):
    start=canonical(monitor['index_url'])
    if not start or not robots(start):
        print('SKIP '+monitor['source']+': robots.txt or connection unavailable',file=sys.stderr)
        return []
    try:
        final,body=fetcher(start)
        if key(final).split('/')[2]!=key(start).split('/')[2]:raise ValueError('foreign redirect')
        links=parse(body).links
    except (HTTPError,URLError,TimeoutError,ValueError,OSError) as e:
        print('SKIP '+monitor['source']+': '+type(e).__name__,file=sys.stderr)
        return []
    candidates=[]
    keys=set()
    for link in links:
        url=canonical(urljoin(final,link))
        if article_allowed(url,monitor) and key(url) not in keys and key(url) not in excluded:
            keys.add(key(url))
            candidates.append(url)
        if len(candidates)>=MAX_LINKS_PER_SOURCE:break
    discovered=[]
    for url in candidates:
        if not robots(url):continue
        try:
            sleeper(0.4)
            final,html=fetcher(url)
            if not article_allowed(final,monitor):continue
            item=analyze(final,monitor,html,day,names=names)
            if item and key(item['url']) not in excluded:
                discovered.append(item)
                excluded.add(key(item['url']))
        except (HTTPError,URLError,TimeoutError,ValueError,OSError) as e:
            print('SKIP article '+type(e).__name__,file=sys.stderr)
    return discovered

def run(root,day,previous=None,*,scanner=discover,name_patterns=None):
    source_data=json.loads((root/'data/report-sources.json').read_text(encoding='utf-8'))
    approved=json.loads((root/'data/report-articles.json').read_text(encoding='utf-8'))['articles']
    out=root/'data/report-pending.json'
    queue=json.loads(out.read_text(encoding='utf-8')).get('candidates',[]) if out.exists() else []
    if previous and previous.exists():
        queue+=json.loads(previous.read_text(encoding='utf-8')).get('candidates',[])
    known={key(item['url']) for item in approved}
    pending=[]
    seen=set()
    for item in queue:
        k=key(item.get('url',''))
        if k and k not in seen and k not in known:
            pending.append(item)
            seen.add(k)
    for source in sorted(source_data['sources'],key=lambda v:v.get('priority',100)):
        monitor=source.get('monitor') or {}
        if source['verification_status']!='verified' or not monitor.get('enabled'):continue
        cfg={**monitor,'source':source['id']}
        findings = (scanner(cfg,seen|known,day,names=name_patterns)
                    if name_patterns is not None else scanner(cfg,seen|known,day))
        for item in findings:
            k=key(item['url'])
            if k and k not in seen and k not in known:
                pending.append(item)
                seen.add(k)
    pending.sort(key=lambda item:(item.get('source',''),item.get('url','')))
    result={'schemaVersion':1,
            'description':'Candidate metadata only. Review original names and links before promoting to verified articles.',
            'candidates':pending[:MAX_PENDING]}
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--root',type=Path,default=Path('.'))
    cli.add_argument('--previous',type=Path)
    cli.add_argument('--today',default=date.today().isoformat())
    args=cli.parse_args()
    names = registered_patterns()
    print('Public registered/fallback player IDs monitored: '+str(len(names)))
    out=run(args.root,args.today,args.previous,name_patterns=names)
    print('Pending review candidates:',len(out['candidates']))

if __name__=='__main__':main()
)
NAMES = {
    '05-070879': re.compile(r'(?<!\w)Philipp\s+Metzger(?!\w)', re.I),
    '05-071969': re.compile(r'(?<!\w)Charlotte\s+Metzger(?!\w)', re.I),
}
CLUB = re.compile(r'\b(?:spvgg\.?\s+m[öo]ssingen|sportvereinigung\s+m[öo]ssingen)\b', re.I)
SKIP_TAGS = {'script','style','noscript','svg','form','nav','header','footer','aside'}
VOID_TAGS = {'meta','link','img','br','hr','input','source','area','base','embed','wbr'}
# Strict post-content containers. Never search broad <main> or <article> wrappers:
# WordPress related-post cards can contain names from unrelated stories.
CONTENT_CLASSES = {'entry-content','post-content','elementor-widget-theme-post-content',
                   'elementor-widget-post-content','td-post-content','news-content'}

def canonical(raw):
    try:
        p = urlsplit(raw)
        if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None,443):
            return ''
        if not re.fullmatch(r'[a-z0-9.-]+',p.hostname):
            return ''
        return urlunsplit(('https',p.hostname.lower(),re.sub(r'/{2,}','/',p.path or '/'),'',''))
    except ValueError:
        return ''

def key(url):
    p=urlsplit(canonical(url))
    return urlunsplit((p.scheme,(p.hostname or '').removeprefix('www.'),p.path.rstrip('/') or '/','','')) if p.hostname else ''

def article_allowed(url,monitor):
    value=canonical(url)
    return bool(value and urlsplit(key(value)).hostname==urlsplit(key(monitor['index_url'])).hostname
        and re.fullmatch(monitor['article_path_regex'],urlsplit(value).path)
        and key(value)!=key(monitor['index_url']))

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links=[]
        self.meta={}
        self.h1=[]
        self.title_parts=[]
        self.body=[]
        self.article=[]
        self.main=[]
        self.editorial=[]
        self.editorial_at=0
        self.depth=0
        self.skip_at=0
        self.article_at=0
        self.main_at=0
        self.h1_at=0
        self.title_at=0
        self.times=[]
    def handle_starttag(self,tag,attrs):
        attr=dict(attrs)
        if tag not in VOID_TAGS:
            self.depth+=1
        if self.skip_at:
            return
        if tag in SKIP_TAGS:
            self.skip_at=self.depth
            return
        classes=set(attr.get('class','').split())
        if tag in ('div','section') and (classes & CONTENT_CLASSES) and not self.editorial_at:
            self.editorial_at=self.depth
        if tag=='article' and not self.article_at:self.article_at=self.depth
        if tag=='main' and not self.main_at:self.main_at=self.depth
        if tag=='h1' and not self.h1_at:self.h1_at=self.depth
        if tag=='title' and not self.title_at:self.title_at=self.depth
        if tag=='a' and attr.get('href'):self.links.append(attr['href'])
        if tag=='meta':
            k=attr.get('property') or attr.get('name')
            if k and attr.get('content'):self.meta[k.lower()]=attr['content']
        if tag=='time' and attr.get('datetime'):self.times.append(attr['datetime'])
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID_TAGS:self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if self.skip_at and self.depth==self.skip_at:self.skip_at=0
        if self.editorial_at and self.depth==self.editorial_at:self.editorial_at=0
        if tag=='article' and self.depth==self.article_at:self.article_at=0
        if tag=='main' and self.depth==self.main_at:self.main_at=0
        if tag=='h1' and self.depth==self.h1_at:self.h1_at=0
        if tag=='title' and self.depth==self.title_at:self.title_at=0
        self.depth=max(self.depth-1,0)
    def handle_data(self,s):
        if self.skip_at or not s.strip():return
        if self.editorial_at:self.editorial.append(s)
        if self.article_at:self.article.append(s)
        if self.main_at:self.main.append(s)
        if self.h1_at:self.h1.append(s)
        if self.title_at:self.title_parts.append(s)
    def headline(self):
        return ' '.join(' '.join(self.h1).split()) or self.meta.get('og:title','') or ' '.join(' '.join(self.title_parts).split())
    def published(self):
        for v in [self.meta.get('article:published_time',''),self.meta.get('datepublished',''),*self.times]:
            try:
                if re.fullmatch(r'\d{4}-\d{2}-\d{2}',v[:10]):
                    date.fromisoformat(v[:10])
                    return v[:10]
            except ValueError:pass
        return None
    def article_text(self):
        # Fail closed without an explicit article-body container.
        # In particular, previews below the story in main/article never count.
        return ' '.join(' '.join(self.editorial).split())

def parse(html):
    p=Page()
    p.feed(html)
    p.close()
    return p

def fetch(url, opener=urlopen):
    req=Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'})
    with opener(req,timeout=18) as resp:
        typ=resp.headers.get('Content-Type','').lower()
        if 'text/html' not in typ and 'application/xhtml+xml' not in typ:
            raise ValueError('non-html response')
        if resp.headers.get('Content-Length') and int(resp.headers['Content-Length'])>MAX_BYTES:
            raise ValueError('oversized response')
        payload=resp.read(MAX_BYTES+1)
        if len(payload)>MAX_BYTES:raise ValueError('oversized response')
        charset=resp.headers.get_content_charset() or 'utf-8'
        return canonical(resp.geturl()),payload.decode(charset,errors='replace')

ROBOTS_CACHE={}
def robots_allowed(url,opener=urlopen):
    p=urlsplit(url)
    origin=p.scheme+'://'+p.netloc
    if origin not in ROBOTS_CACHE:
        try:
            with opener(Request(origin+'/robots.txt',headers={'User-Agent':USER_AGENT}),timeout=12) as resp:
                contents=resp.read(200000).decode('utf-8',errors='replace')
            rp=RobotFileParser()
            rp.parse(contents.splitlines())
            ROBOTS_CACHE[origin]=rp
        except HTTPError as e:
            ROBOTS_CACHE[origin]=e.code in (404,410)
        except (URLError,TimeoutError,OSError,ValueError):
            ROBOTS_CACHE[origin]=False
    obj=ROBOTS_CACHE[origin]
    return obj if isinstance(obj,bool) else obj.can_fetch(USER_AGENT,url)

def analyze(url,monitor,html,day):
    if not article_allowed(url,monitor):return None
    p=parse(html)
    body=p.article_text()
    if len(body)<110:return None
    matched=[ident for ident,pattern in NAMES.items() if pattern.search(body)]
    club=bool(CLUB.search(body))
    if not matched and not club:return None
    headline=p.headline().strip()[:220]
    if len(headline)<10:return None
    return {'url':canonical(url),'source':monitor['source'],'title':headline,
            'date':p.published(),'players':matched,
            'evidence':'explicit-name-in-article-body' if matched else 'club-name-in-article-body',
            'club_context':club,'detected_on':day,'status':'needs-review'}

def discover(monitor,excluded,day,*,fetcher=fetch,robots=robots_allowed,sleeper=time.sleep):
    start=canonical(monitor['index_url'])
    if not start or not robots(start):
        print('SKIP '+monitor['source']+': robots.txt or connection unavailable',file=sys.stderr)
        return []
    try:
        final,body=fetcher(start)
        if key(final).split('/')[2]!=key(start).split('/')[2]:raise ValueError('foreign redirect')
        links=parse(body).links
    except (HTTPError,URLError,TimeoutError,ValueError,OSError) as e:
        print('SKIP '+monitor['source']+': '+type(e).__name__,file=sys.stderr)
        return []
    candidates=[]
    keys=set()
    for link in links:
        url=canonical(urljoin(final,link))
        if article_allowed(url,monitor) and key(url) not in keys and key(url) not in excluded:
            keys.add(key(url))
            candidates.append(url)
        if len(candidates)>=MAX_LINKS_PER_SOURCE:break
    discovered=[]
    for url in candidates:
        if not robots(url):continue
        try:
            sleeper(0.4)
            final,html=fetcher(url)
            if not article_allowed(final,monitor):continue
            item=analyze(final,monitor,html,day)
            if item and key(item['url']) not in excluded:
                discovered.append(item)
                excluded.add(key(item['url']))
        except (HTTPError,URLError,TimeoutError,ValueError,OSError) as e:
            print('SKIP article '+type(e).__name__,file=sys.stderr)
    return discovered

def run(root,day,previous=None,*,scanner=discover):
    source_data=json.loads((root/'data/report-sources.json').read_text(encoding='utf-8'))
    approved=json.loads((root/'data/report-articles.json').read_text(encoding='utf-8'))['articles']
    out=root/'data/report-pending.json'
    queue=json.loads(out.read_text(encoding='utf-8')).get('candidates',[]) if out.exists() else []
    if previous and previous.exists():
        queue+=json.loads(previous.read_text(encoding='utf-8')).get('candidates',[])
    known={key(item['url']) for item in approved}
    pending=[]
    seen=set()
    for item in queue:
        k=key(item.get('url',''))
        if k and k not in seen and k not in known:
            pending.append(item)
            seen.add(k)
    for source in sorted(source_data['sources'],key=lambda v:v.get('priority',100)):
        monitor=source.get('monitor') or {}
        if source['verification_status']!='verified' or not monitor.get('enabled'):continue
        cfg={**monitor,'source':source['id']}
        for item in scanner(cfg,seen|known,day):
            k=key(item['url'])
            if k and k not in seen and k not in known:
                pending.append(item)
                seen.add(k)
    pending.sort(key=lambda item:(item.get('source',''),item.get('url','')))
    result={'schemaVersion':1,
            'description':'Candidate metadata only. Review original names and links before promoting to verified articles.',
            'candidates':pending[:MAX_PENDING]}
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--root',type=Path,default=Path('.'))
    cli.add_argument('--previous',type=Path)
    cli.add_argument('--today',default=date.today().isoformat())
    args=cli.parse_args()
    out=run(args.root,args.today,args.previous)
    print('Pending review candidates:',len(out['candidates']))

if __name__=='__main__':main()
