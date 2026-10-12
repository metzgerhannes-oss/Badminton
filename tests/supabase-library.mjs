import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {SUPABASE_ROOT} from "../scripts/supabase-read.mjs";

const source=await readFile("library.js","utf8");
const styles=await readFile("styles.css","utf8");
const fields={
 "library-age":{value:"U13"},
 "library-association":{value:"BAW-Baden-Württemberg",innerHTML:""},
 "library-search":{value:"Charlotte"},
 "library-club":{value:"Sportvereinigung Mössingen 1904 e.V."}
};
const requests=[];
const context=vm.createContext({
 URLSearchParams,URL,console,
 readPublicRows:async(path)=>{
  requests.push(path);
  if(path.startsWith("clubs?")){
   const qs=new URLSearchParams(path.split("?")[1]);
   if(qs.get("select")==="id"){
    // The official club name differs from the player's DBV abbreviation.
    if(qs.get("name")?.includes("Sportvereinigung Mössingen"))
     return {range:"0-0/1",rows:[{id:"spvgg-moessingen"}]};
    return {range:"*/0",rows:[]};
   }
   return {range:"0-1/2",rows:[
    {association:"BWBV"},{association:"BAW-Baden-Württemberg"}
   ]};
  }
  if(path.startsWith("players?")){
   const qs=new URLSearchParams(path.split("?")[1]);
   if(fields["library-club"].value.startsWith("Sportvereinigung")){
    assert.equal(qs.get("club_id"),"in.(spvgg-moessingen)",
     "Must search by linked club_id rather than the differently worded players.club");
    assert.equal(qs.has("club"),false);
   }else{
    assert.equal(qs.get("club"),"ilike.*SpVgg. Mössingen*",
     "Abbreviated DBV name must continue to support a direct text match");
   }
   return {range:"0-0/13",rows:[
    {dbv_id:"05-071969",name:"Charlotte Metzger",birth_year:2014,age_class:"U13",
     club:"SpVgg. Mössingen",association:"BAW-Baden-Württemberg",last_ranking_week:"2026-KW41"}
   ]};
  }
  throw Error("Unexpected query "+path);
 },
 fetch:async()=>{throw Error("Library must use public Supabase read module for remote queries")},
 document:{getElementById:id=>fields[id]||null,addEventListener(){}}
});
vm.runInContext(source.replace(/^import[^\n]+\n/gm,""),context,{filename:"library.js"});

const path=vm.runInContext("dbPath(0)",context);
const params=new URLSearchParams(path.split("?")[1]);
assert.equal(params.get("age_class"),"eq.U13");
assert.equal(params.get("association"),"eq.BAW-Baden-Württemberg");
assert.equal(params.get("club"),"ilike.*Sportvereinigung Mössingen 1904 e.V.*");
assert.equal(params.get("or"),"(name.ilike.*Charlotte*,dbv_id.ilike.*Charlotte*)");
assert.equal(params.get("limit"),"40");

const page=await vm.runInContext("dbPage(0)",context);
assert.equal(page.people.length,1);
assert.equal(page.people[0].id,"05-071969");
assert.equal(page.people[0].club,"SpVgg. Mössingen");
assert.equal(page.total,13);
assert.ok(requests.some(s=>s.startsWith("clubs?")&&s.includes("name=ilike.")));
assert.ok(requests.some(s=>s.startsWith("players?")&&s.includes("club_id=in.")));

await vm.runInContext("dbAssociations()",context);
assert.match(fields["library-association"].innerHTML,/BAW-Baden-Württemberg/);
assert.doesNotMatch(fields["library-association"].innerHTML,/>BWBV</);
assert.equal(fields["library-association"].value,"BAW-Baden-Württemberg");

// DBV abbreviation remains searchable, not only full club directory names.
fields["library-club"].value="SpVgg. Mössingen";
const fallback=await vm.runInContext("dbPage(0)",context);
assert.equal(fallback.people.length,1);
assert.ok(requests.at(-1).startsWith("players?"));
assert.match(styles,/\.library-more\[hidden\]\{display:none!important\}/);
assert.match(source,/import \{readPublicRows\} from "\.\/scripts\/supabase-read\.mjs"/);
assert.doesNotMatch(source,/fetch\(API\+/);
assert.match(source,/loadBackup\(\)/);
assert.match(source,/Supabase nicht erreichbar/);
console.log("Supabase player directory: full/abbreviated club names, association normalization, 13 club players and hidden paging tested.");
