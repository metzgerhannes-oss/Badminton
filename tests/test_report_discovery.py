"""Offline tests for the source watcher. No network, database or external API calls."""
import importlib.util
from pathlib import Path
import json
import tempfile
import unittest

PATH=Path(__file__).resolve().parents[1]/'scripts/discover-reports.py'
spec=importlib.util.spec_from_file_location('discover_reports',PATH)
watcher=importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)
CFG={'source':'club-moessingen',
     'index_url':'https://www.spvgg.org/abteilungen/badminton/aktuelles',
     'article_path_regex':r'^/abteilungen/badminton/aktuelles/[a-z0-9-]+/?$'}
HTML='''<!doctype html><html><head>
<meta property="article:published_time" content="2026-10-10T09:00:00+02:00"></head>
<body><nav>Philipp Metzger</nav>
<main><article><div class="entry-content"><h1>Neue Badminton-Erfolge in Mössingen</h1>
<p>Im Jugendturnier kam Philipp Metzger nach einem starken Spiel weit nach vorne.</p>
<p>Auch Charlotte Metzger war im Wettbewerb vertreten und erreichte mehrere gute Ballwechsel. Die Sportvereinigung Mössingen zeigt Fotos.</p>
</div></article></main><footer>Philipp Metzger</footer></body></html>'''

class ReportDiscoveryTests(unittest.TestCase):
    def test_real_names_are_only_review_candidates(self):
        item=watcher.analyze('https://www.spvgg.org/abteilungen/badminton/aktuelles/neue-erfolge',CFG,HTML,'2026-10-10')
        self.assertEqual(item['players'],['05-070879','05-071969'])
        self.assertEqual(item['date'],'2026-10-10')
        self.assertEqual(item['status'],'needs-review')

    def test_names_in_navigation_do_not_count(self):
        page='<nav>Philipp Metzger</nav><main><article><div class="entry-content"><h1>Jugendturnier in Schorndorf</h1><p>Viele andere Mannschaften und Spielende haben sich bei dieser Badminton-Veranstaltung getroffen. Alle haben engagiert gespielt und anschließend gemeinsam gefeiert.</p></div></article></main>'
        self.assertIsNone(watcher.analyze('https://spvgg.org/abteilungen/badminton/aktuelles/schorndorf',CFG,page,'2026-10-10'))

    def test_club_only_cannot_be_player_mention(self):
        page='<main><article><div class="entry-content"><h1>Regionalliga-Auftakt Mössingen</h1><p>Die SpVgg Mössingen spielte gegen Reutlingen und gewann deutlich. Der lange ausführliche Bericht betrifft die regionale Badminton-Mannschaft und eine spannende Begegnung.</p></div></article></main>'
        item=watcher.analyze('https://spvgg.org/abteilungen/badminton/aktuelles/regionalliga',CFG,page,'2026-10-10')
        self.assertEqual(item['players'],[])
        self.assertEqual(item['evidence'],'club-name-in-article-body')

    def test_unrelated_article_ignored(self):
        page='<main><article><div class="entry-content"><h1>Badminton in Bayern</h1><p>Es gab schöne Jugendspiele mit Mannschaften aus anderen Orten. Viele Besucher sahen ausgezeichnete Ballwechsel auf den Spielfeldern während der vergangenen Woche.</p></div></article></main>'
        self.assertIsNone(watcher.analyze('https://spvgg.org/abteilungen/badminton/aktuelles/bayern',CFG,page,'2026-10-10'))

    def test_no_foreign_hosts_or_unapproved_paths(self):
        for url in ['http://spvgg.org/abteilungen/badminton/aktuelles/test','https://spvgg.org.evil.net/abteilungen/badminton/aktuelles/test','https://spvgg.org/anderes/test','https://spvgg.org/abteilungen/badminton/aktuelles','https://evil.net/abteilungen/badminton/aktuelles/test']:
            with self.subTest(url=url):
                self.assertFalse(watcher.article_allowed(url,CFG))

    def test_related_story_teasers_cannot_create_false_child_mentions(self):
        html='''<main><article><h1>Regionalliga in Mössingen</h1>
        <div class="entry-content"><p>Die erste Mannschaft spielte an diesem Wochenende ihre beiden Begegnungen gegen starke Gastmannschaften und erlebte spannende Sätze. Die Mannschaft trat mit ihren Erwachsenen an.</p></div>
        <section class="related-posts"><h2>Ähnliche Berichte</h2>
        <p>Aus einem ganz anderen Jugendturnier: Charlotte Metzger und Philipp Metzger spielten sehr erfolgreich.</p>
        </section></article></main>'''
        self.assertIsNone(watcher.analyze('https://spvgg.org/abteilungen/badminton/aktuelles/regionalliga',CFG,html,'2026-10-10'))

    def test_www_and_without_www_share_identity(self):
        self.assertEqual(watcher.key('https://www.spvgg.org/abteilungen/badminton/aktuelles/test/'),
                         watcher.key('https://spvgg.org/abteilungen/badminton/aktuelles/test'))

    def test_listing_deduplicates_identical_articles(self):
        html='<main><a href="/abteilungen/badminton/aktuelles/neue-erfolge">A</a><a href="https://spvgg.org/abteilungen/badminton/aktuelles/neue-erfolge">B</a><a href="https://example.com/abteilungen/badminton/aktuelles/fake">C</a></main>'
        calls=[]
        def fetch(url):
            calls.append(url)
            if url.endswith('aktuelles'):return CFG['index_url'],html
            return url,HTML
        found=watcher.discover(CFG,set(),'2026-10-10',fetcher=fetch,robots=lambda u:True,sleeper=lambda n:None)
        self.assertEqual(len(found),1)
        self.assertEqual(len(calls),2)

    def test_previous_review_candidates_and_approved_articles_deduplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)
            (base/'data').mkdir()
            (base/'data/report-sources.json').write_text(json.dumps({'sources':[{'id':'club-moessingen','verification_status':'verified','monitor':{'enabled':True,'index_url':CFG['index_url'],'article_path_regex':CFG['article_path_regex']}}]}))
            known_url='https://www.spvgg.org/abteilungen/badminton/aktuelles/known'
            pending_url='https://spvgg.org/abteilungen/badminton/aktuelles/new'
            (base/'data/report-articles.json').write_text(json.dumps({'articles':[{'url':known_url}]}))
            candidate={'source':'club-moessingen','url':pending_url,'players':['05-070879'],'status':'needs-review'}
            (base/'data/report-pending.json').write_text(json.dumps({'candidates':[candidate,{'url':known_url}]}))
            previous=base/'previous.json'
            previous.write_text(json.dumps({'candidates':[candidate]}))
            def scan(cfg,seen,day):
                return [dict(candidate),{'url':known_url,'source':'club-moessingen','players':[]}]
            result=watcher.run(base,'2026-10-10',previous,scanner=scan)
            self.assertEqual([x['url'] for x in result['candidates']],[pending_url])


    def test_approval_requires_explicit_confirmation_and_moves_candidate(self):
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'data').mkdir()
            url='https://spvgg.org/abteilungen/badminton/aktuelles/neuer-bericht'
            (root/'data/report-pending.json').write_text(json.dumps({'candidates':[{
                'url':url,'title':'Neue Rangliste mit bekannten Namen',
                'source':'club-moessingen','date':None,'players':['05-070879'],
                'club_context':True,'status':'needs-review'}]}))
            (root/'data/report-articles.json').write_text(json.dumps({'articles':[]}))
            (root/'data/report-sources.json').write_text(json.dumps({'sources':[{'id':'club-moessingen'}]}))
            executable=Path(__file__).resolve().parents[1]/'scripts/approve-report.py'
            command=[sys.executable,str(executable),'--root',str(root),'--url',url,'--players','05-070879']
            refused=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(refused.returncode,0)
            self.assertEqual(len(json.loads((root/'data/report-articles.json').read_text())['articles']),0)
            approved=subprocess.run(command+['--confirm-original'],capture_output=True,text=True)
            self.assertEqual(approved.returncode,0,approved.stderr)
            items=json.loads((root/'data/report-articles.json').read_text())['articles']
            self.assertEqual(len(items),1)
            self.assertEqual(items[0]['players'],['05-070879'])
            self.assertEqual(items[0]['status'],'verified')
            self.assertEqual(len(json.loads((root/'data/report-pending.json').read_text())['candidates']),0)


    def test_followed_player_names_from_public_queue(self):
        calls=[]
        def api(path):
            calls.append(path)
            if path.startswith('player_history_imports?'):
                return [{'dbv_id':'05-061350'},{'dbv_id':'05-070006'},
                        {'dbv_id':'05-061350'},{'dbv_id':'invalid'}]
            return [{'dbv_id':'05-061350','name':'Sarah Storz'},
                    {'dbv_id':'05-070006','name':'Vinzent Pius Ott'},
                    {'dbv_id':'05-999999','name':'Not Followed'}]
        names=watcher.registered_patterns(api)
        self.assertEqual(len(calls),2)
        self.assertIn('dbv_id=in.(05-061350,05-070006)',calls[1])
        self.assertEqual(set(names),
                         {'05-070879','05-071969','05-061350','05-070006'})
        html='<article><div class="entry-content"><h1>Meisterschaft 2026</h1><p>Sarah Storz und Vinzent Pius Ott sind in der Meldeliste. Der Bericht beschreibt nur das geplante Turnier und bestätigt keine Ergebnisse.</p></div></article>'
        result=watcher.analyze(
            'https://spvgg.org/abteilungen/badminton/aktuelles/neue-meisterschaft',
            CFG,html,'2026-10-10',names=names)
        self.assertEqual(result['players'],['05-061350','05-070006'])
        self.assertFalse(names['05-061350'].search('Sarah Storzinger'))
        self.assertFalse(names['05-070006'].search('Vinzent Pius Ottmann'))

    def test_registry_outage_does_not_disable_known_profile_monitoring(self):
        from urllib.error import URLError
        def fail(_):
            raise URLError('offline')
        self.assertEqual(set(watcher.registered_patterns(fail)),set(watcher.NAMES))

    def test_dynamic_patterns_reach_scanner_but_not_public_feed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'data').mkdir()
            (root/'data/report-sources.json').write_text(json.dumps({'sources':[{
                'id':'club-moessingen','verification_status':'verified',
                'monitor':{'enabled':True,'index_url':CFG['index_url'],
                           'article_path_regex':CFG['article_path_regex']}
            }]}))
            (root/'data/report-articles.json').write_text(json.dumps({'articles':[]}))
            (root/'data/report-pending.json').write_text(json.dumps({'candidates':[]}))
            import re
            patterns={'05-061350':re.compile('Sarah Storz')}
            def scanner(cfg,seen,day,*,names):
                self.assertEqual(names,patterns)
                return [{'source':'club-moessingen','url':
                  'https://spvgg.org/abteilungen/badminton/aktuelles/sarah-storz',
                  'players':['05-061350'],'status':'needs-review'}]
            result=watcher.run(root,'2026-10-10',scanner=scanner,name_patterns=patterns)
            self.assertEqual(result['candidates'][0]['status'],'needs-review')

if __name__=='__main__':
    unittest.main()
