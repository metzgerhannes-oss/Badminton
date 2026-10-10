import importlib.util
import unittest
spec=importlib.util.spec_from_file_location("library","scripts/player-library.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LibraryTest(unittest.TestCase):
 def test_discrete_records(self):
  row=dict(id="05-070879",firstName="A",lastName="Beispiel",birthYear=2016,
           ageClass="U11",club="Testverein",clubId="",association="BAW-Baden-Württemberg")
  data,_=module.compile_players([row,row],2026,41)
  self.assertEqual(len(data["U11"]),1)
  self.assertEqual(data["U11"][0]["club"],"Testverein")
 def test_invalid_records(self):
  row=dict(id="local-1",firstName="A",lastName="Beispiel",birthYear=2016,
           ageClass="U11",club="Testverein")
  data,_=module.compile_players([row],2026,41)
  self.assertEqual(sum(len(group) for group in data.values()),0)
 def test_conflict_guard(self):
  base=dict(id="05-070879",firstName="A",lastName="Beispiel",birthYear=2016,
            ageClass="U11",club="Testverein")
  data,conflicts=module.compile_players([base,{**base,"firstName":"B"}],2026,41)
  self.assertEqual(data["U11"],[])
  self.assertEqual(conflicts,["05-070879"])
if __name__=="__main__":
 unittest.main()
