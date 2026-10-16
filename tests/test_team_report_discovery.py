"""Offline source and privacy tests for the automatic team-report importer."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

PATH=Path(__file__).resolve().parents[1]/'scripts/import-team-reports.py'
spec=importlib.util.spec_from_file_location('team_reports',PATH)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
INDEX='https://www.spvgg.org/abteilungen/badminton/aktuelles'
URL=INDEX+'/heimspiel-2026'
HTML='<main><article><div class="com-content-article__body"><h1>Erster Mannschaftsspieltag</h1><p>Die SpVgg Mössingen hat in der Regionalliga am Wochenende spannende Begegnungen gespielt. Die Mannschaft gewann in der Rückrunde ein Heimspiel.</p></div></article></main>'
UNRELATED='<main><article><div class="com-content-article__body"><h1>Sommerfest</h1><p>Die SpVgg Mössingen hat sich zum alljährlichen Vereinsfest getroffen. Viele Mitglieder hatten Spaß an diesem schönen Sommertag und trafen ehemalige Trainer.</p></div></article></main>'

class TeamReports(unittest.TestCase):
 def test_team_only_real_editorial_body(self):
  self.assertTrue(mod.qualifies(HTML)[0])
  self.assertFalse(mod.qualifies(UNRELATED)[0])
  self.assertFalse(mod.qualifies('<nav>SpVgg Mössingen Mannschaft Regionalliga Sieg</nav>'+UNRELATED.replace('SpVgg Mössingen','Sportverein Baden Baden'))[0])

 def test_official_https_path_only(self):
  monitor={'index_url':INDEX,'article_path_regex':r'^/abteilungen/badminton/aktuelles/[a-z0-9-]+/?$'}
  self.assertTrue(mod.valid_link(URL,monitor))
  self.assertFalse(mod.valid_link('https://www.spvgg.org.evil.com/abteilungen/badminton/aktuelles/heimspiel-2026',monitor))
  self.assertFalse(mod.valid_link('https://www.spvgg.org/andere-seite',monitor))
  self.assertFalse(mod.valid_link('http://www.spvgg.org/abteilungen/badminton/aktuelles/heimspiel-2026',monitor))

 def test_private_details_never_published_and_dedup_persists(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'data').mkdir()
   (root/'data/report-sources.json').write_text(json.dumps({'sources':[{
    'id':'club-moessingen','verification_status':'verified',
    'monitor':{'enabled':True,'index_url':INDEX,
               'article_path_regex':r'^/abteilungen/badminton/aktuelles/[a-z0-9-]+/?$'}
   }]}))
   (root/'data/team-report-links.json').write_text(json.dumps({
    'reports':[{'source_id':'club-moessingen','club_id':'spvgg-moessingen',
      'url':URL,'published_on':'2026-10-01',
      'title':'Private Name Must Be Replaced'}]}))
   second=INDEX+'/auswaertsspiel-2026'
   calls=[]
   def fetch(url):
    calls.append(url)
    if '/aktuelles?' in url or url==INDEX:
     return INDEX,'<main><a href="'+URL+'">Known</a><a href="'+second+'">New</a><a href="https://malicious.example/abteilungen/badminton/aktuelles/fake">Fake</a></main>'
    return url,HTML
   status=mod.scan(root,fetcher=fetch,robots=lambda url:True,sleeper=lambda _:None,today='2026-10-16')
   self.assertEqual(status['stored'],2)
   self.assertEqual(status['inspected'],1)
   data=(root/'data/team-report-links.json').read_text()
   self.assertNotIn('Private Name',data)
   self.assertNotIn('Die SpVgg',data)
   self.assertNotIn('malicious.example',data)
   self.assertIn(second,data)
   self.assertEqual(len(json.loads(data)['reports']),2)

 def test_source_outage_never_deletes_existing(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'data').mkdir()
   (root/'data/report-sources.json').write_text(json.dumps({'sources':[{
    'id':'club-moessingen','verification_status':'verified',
    'monitor':{'enabled':True,'index_url':INDEX,'article_path_regex':r'^/abteilungen/badminton/aktuelles/[a-z0-9-]+/?$'}
   }]}))
   original={'reports':[{'source_id':'club-moessingen','club_id':'spvgg-moessingen','url':URL,'published_on':None}]}
   target=root/'data/team-report-links.json'
   target.write_text(json.dumps(original))
   def unavailable(_):raise OSError('source offline')
   with self.assertRaises(RuntimeError):
    mod.scan(root,fetcher=unavailable,robots=lambda url:True,sleeper=lambda _:None)
   self.assertEqual(json.loads(target.read_text()),original)

if __name__=='__main__':unittest.main()
