import test from "node:test";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {tokenMatches} from "../supabase/functions/private-dbv-weekly/auth.mjs";
import assert from "node:assert/strict";
import {officialPublication,buildWeeklyPayload,importDecision,officialXlsxCandidates} from "../scripts/private-dbv-weekly-model.mjs";
import {parseOfficialXlsxXml} from "../supabase/functions/private-dbv-weekly/xlsx.mjs";
const stamp={year:2026,week:43,publishedAt:"2026-10-21T09:30:00.000Z"};
function rows(n=5001) {
  return Array.from({length:n},(_,i)=>({
    id:"05-"+String(i+1).padStart(6,"0"),firstName:"Test",lastName:"Spieler"+i,
    birthYear:2016,ageClass:"U11",gender:"M",discipline:"HE",
    points:1200-i/1000,tournaments:2,overallRank:i+1,
    association:"Testverband",club:"Testverein",clubId:"05-123"
  }));
}
test("official Berlin publication stamp is authoritative and DST-safe",()=>{
  const page="<p>zuletzt aktualisiert: 21.10.2026 11:30:00</p>";
  assert.deepEqual(officialPublication(page,Date.UTC(2026,9,27)),stamp);
  assert.throws(()=>officialPublication("Rangliste KW 42 "+page,Date.UTC(2026,9,27)),/week_conflict/);
  assert.throws(()=>officialPublication("Rangliste KW 43",Date.UTC(2026,9,27)),/stamp_missing/);
  assert.throws(()=>officialPublication(page,Date.UTC(2026,9,19)),/out_of_range/);
});
test("archive link must actually be listed with the same week, never synthesized",()=>{
 const row=(week,href)=>'<tr><td>Ranking_2026_KW'+week+'.xlsx</td><td><a href="'+href+'">herunterladen</a></td></tr>';
 const kw43="/uploads/ranking/Ranking_2026_KW43.xlsx";
 const html="<table>"+row("43",kw43)+row("42","/uploads/ranking/Ranking_2026_KW42.xlsx")+"</table>";
 assert.deepEqual(officialXlsxCandidates(stamp,html),["https://turniere.badminton.de"+kw43]);
 const kw44={...stamp,week:44,publishedAt:"2026-10-28T10:45:00.000Z"};
 assert.deepEqual(officialXlsxCandidates(kw44,html),[],
   "newer /ranking timestamp does not prove that a KW44 archive exists");
 assert.deepEqual(officialXlsxCandidates(stamp,"<table></table>"),[]);
 assert.deepEqual(officialXlsxCandidates(stamp,"<p>"+kw43+"</p>"),[],
   "a filename without a real link is not enough");
 assert.deepEqual(officialXlsxCandidates(stamp,"<table>"+row("43","https://other.example"+kw43)+"</table>"),[],
   "never follow a third-party archive host");
 assert.deepEqual(officialXlsxCandidates(stamp,"<table>"+row("43","/uploads/ranking/Ranking_2026_KW44.xlsx")+"</table>"),[],
   "visible filename and the linked binary must be identical");
 assert.throws(()=>officialXlsxCandidates({year:2026,week:0},html),/publication_invalid/);
 const edge=readFileSync(new URL("../supabase/functions/private-dbv-weekly/index.ts",import.meta.url),"utf8");
 assert.match(edge,/source\(ARCHIVE,"text\/html"/);
 assert.match(edge,/officialXlsxCandidates\(publication,archiveHtml\)/);
 assert.doesNotMatch(edge,/\/ranking\/download/);
 assert.match(edge,/fetchCurrentOfficialRows\(publication\)/);
});

test("full synthetic ranking, deterministic identity and discipline totals",()=>{
  const payload=buildWeeklyPayload(rows(),stamp);
  assert.equal(payload.total,5001);
  assert.equal(payload.rankingTotal,5001);
  assert.equal(payload.players[0].rankings[0][0],"HE");
  assert.equal(payload.players[0].rankings[0][3],1);
  assert.equal(payload.sourcePublishedAt,stamp.publishedAt);
  assert.equal(new Set(payload.players.map(x=>x.id)).size,5001);
});
test("full official U09 cohort must not be dropped from a weekly XLSX",()=>{
 const youngest=rows(256).map((r,i)=>({...r,id:"09-"+String(i+1).padStart(6,"0"),
  ageClass:"U09",birthYear:2018,gender:"M"}));
 const payload=buildWeeklyPayload([...rows(),...youngest],stamp);
 assert.equal(payload.total,5257);
 assert.equal(payload.rankingTotal,5257);
 assert.equal(payload.players.filter(p=>p.ageClass==="U09").length,256);
 assert.equal(payload.players.filter(p=>p.ageClass==="U09"&&p.rankings.length===1).length,256);
});

test("reject missing coverage, duplicate identity contradictions and old weeks",()=>{
  assert.throws(()=>buildWeeklyPayload(rows(4999),stamp),/source_row_coverage/);
  const bad=rows();
  bad.push({...bad[0],lastName:"Other"});
  const p=buildWeeklyPayload(bad,stamp);
  assert.equal(p.total,5000);
  assert.equal(importDecision({year:2026,week:42},stamp),"new");
  assert.equal(importDecision({year:2026,week:43,sourcePublishedAt:stamp.publishedAt},stamp),"unchanged");
  assert.throws(()=>importDecision({year:2026,week:44},stamp),/older/);
  assert.throws(()=>importDecision({year:2026,week:43,sourcePublishedAt:"2026-10-21T10:00:00.000Z"},stamp),/same_week/);
});
test("restricted XLSX XML parses shared strings and complete synthetic rows",()=>{
  const strings=["Dis","SpielerID","GJahr","Punkte","AKL2","GS","Vorname","Nachname","LVName","Turniere","Verein","ClubID","HE","U11","M","Test","Spieler","Testverband","Testverein","05-123"];
  const shared='<?xml version="1.0"?><sst>'+strings.map(s=>"<si><t>"+s+"</t></si>").join("")+"</sst>";
  const header=strings.slice(0,12).map((_,i)=>'<c r="'+String.fromCharCode(65+i)+'1" t="s"><v>'+i+'</v></c>').join("");
  let data="";
  for(let i=0;i<5001;i++){
    const r=i+2;
    data+='<row r="'+r+'"><c r="A'+r+'" t="s"><v>12</v></c>'+
      '<c r="B'+r+'" t="inlineStr"><is><t>05-'+String(i+1).padStart(6,"0")+'</t></is></c>'+
      '<c r="C'+r+'"><v>2016</v></c><c r="D'+r+'"><v>1200</v></c>'+
      '<c r="E'+r+'" t="s"><v>13</v></c><c r="F'+r+'" t="s"><v>14</v></c>'+
      '<c r="G'+r+'" t="s"><v>15</v></c>'+
      '<c r="H'+r+'" t="inlineStr"><is><t>Spieler'+i+'</t></is></c>'+
      '<c r="I'+r+'" t="s"><v>17</v></c><c r="J'+r+'"><v>2</v></c>'+
      '<c r="K'+r+'" t="s"><v>18</v></c><c r="L'+r+'" t="s"><v>19</v></c></row>';
  }
  const xml='<worksheet><sheetData><row r="1">'+header+"</row>"+data+"</sheetData></worksheet>";
  const parsed=parseOfficialXlsxXml({"xl/sharedStrings.xml":shared,"xl/worksheets/sheet1.xml":xml});
  assert.equal(parsed.length,5001);
  assert.equal(buildWeeklyPayload(parsed,stamp).rankingTotal,5001);
  assert.throws(()=>parseOfficialXlsxXml({"xl/worksheets/sheet1.xml":"<!DOCTYPE x><worksheet/>"}),/xml_rejected/);
});

test("private cron token uses bounded constant-time digest, not public credentials",async()=>{
  const secret="synthetic-private-token-not-for-production-12345";
  assert.equal(await tokenMatches(secret,secret,webcrypto),true);
  assert.equal(await tokenMatches(secret,secret.slice(0,-1)+"x",webcrypto),false);
  assert.equal(await tokenMatches("short","short",webcrypto),false);
  assert.equal(await tokenMatches(secret,"",webcrypto),false);
});
test("private scheduler still requires Vault and database authorization and never restores GitHub publish",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/private-dbv-directory.yml",import.meta.url),"utf8");
  const edge=readFileSync(new URL("../supabase/functions/private-dbv-weekly/index.ts",import.meta.url),"utf8");
  const sql=readFileSync(new URL("../supabase/migrations/20261027141000_private_dbv_weekly_scheduler_guard.sql",import.meta.url),"utf8");
  assert.doesNotMatch(workflow,/id-token:\s*write|\bpublish:\s*\n|secrets\./);
  assert.match(edge,/authorized\(req\)/,"Authorization gate is before any scheduler claim");
  assert.match(edge,/authorize_private_dbv_weekly/,"The token is checked by a server-only DB RPC");
  assert.match(edge,/claim_private_dbv_weekly/,"Database backoff is checked before source download");
  assert.match(edge,/source_forbidden/);
  assert.match(edge,/source_throttled/);
  assert.match(edge,/fetchCurrentOfficialRows/);
  assert.match(edge,/claim_private_dbv_weekly/);
  assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(sql,/cron\.schedule\s*\(/);
  assert.doesNotMatch(sql,/CREATE EXTENSION IF NOT EXISTS pg_net/i);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.ingest_private_dbv_directory/);
});
