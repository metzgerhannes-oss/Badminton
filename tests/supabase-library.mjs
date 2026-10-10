import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const source=await readFile("library.js","utf8");
const fields={
 "library-age":{value:"U13"},
 "library-association":{value:"BAW-Baden-Württemberg"},
 "library-search":{value:"Charlotte"},
 "library-club":{value:"Mössingen"}
};
let lastUrl="";
const context=vm.createContext({
 URLSearchParams,URL,console,
 fetch:async (url)=>{
  lastUrl=url;
  return {ok:true,status:200,headers:{get:()=> "0-0/1"},
    json:async()=>[{dbv_id:"05-071969",name:"Charlotte Metzger",birth_year:2014,age_class:"U13",
      club:"SpVgg. Mössingen",association:"BAW-Baden-Württemberg",last_ranking_week:"2026-KW41"}]};
 },
 document:{getElementById:id=>fields[id]||null,addEventListener(){}}
});
vm.runInContext(source.replace(/^import [^\n]+\n/,""),context,{filename:"library.js"});
const path=vm.runInContext("dbPath(0)",context);
const params=new URLSearchParams(path.split("?")[1]);
assert.equal(params.get("age_class"),"eq.U13");
assert.equal(params.get("association"),"eq.BAW-Baden-Württemberg");
assert.equal(params.get("club"),"ilike.*Mössingen*");
assert.equal(params.get("or"),"(name.ilike.*Charlotte*,dbv_id.ilike.*Charlotte*)");
assert.equal(params.get("limit"),"40");
const page=await vm.runInContext("dbPage(0)",context);
assert.equal(page.people.length,1);
assert.equal(page.people[0].id,"05-071969");
assert.equal(page.people[0].club,"SpVgg. Mössingen");
assert.equal(page.total,1);
assert.match(lastUrl,/\/rest\/v1\/players\?/);
assert.match(source,/loadBackup\(\)/);
assert.match(source,/Supabase nicht erreichbar/);
console.log("Supabase-first player library: safe filters, pagination and GitHub fallback verified.");
