import assert from "node:assert/strict";
import {summarizeMatchReconciliation,renderAggregateReport} from "./match-reconciliation-audit.mjs";

const match={
 dbv_id:"99-000001",source_key:"tournament:synthetic:a",
 source_name:"Synthetic",source_kind:"third-party-match-card",category:"tournament",
 competition_id:"synthetic-tournament",event:"Synthetic age group",
 match_date:"2026-10-20",match_year:2026,discipline:"Einzel",
 round_label:"Viertelfinale",player_side:1,winning_side:1,
 opponent_names:["Synthetic Opponent"],partner_names:[],
 games:[[21,11],[21,15]],outcome_evidence:null,
 source_url:"https://example.invalid/tournament/fixture"
};
const clone=obj=>structuredClone(obj);
const rekey=clone(match);rekey.source_key="tournament:synthetic:old";
const partial=clone(rekey);partial.source_key="tournament:synthetic:partial";
partial.round_label="Achtelfinale";
const unrelated=clone(match);unrelated.source_key="tournament:synthetic:other";
unrelated.games=[[21,9],[21,14]];unrelated.opponent_names=["Different Synthetic Opponent"];
const impostor=clone(rekey);impostor.dbv_id="99-000002";impostor.source_key="another-person";
const idConflict=clone(match);idConflict.games=[[21,10],[21,17]];
const zeroScore=clone(rekey);zeroScore.source_key="synthetic-zero";
zeroScore.games=[];zeroScore.outcome_evidence=null;
const quarantined=clone(match);quarantined.source_key="synthetic-quarantine";
const missingSameKey=clone(match);missingSameKey.games=[];missingSameKey.outcome_evidence=null;
const metadataSameKey=clone(match);metadataSameKey.source_name="Synthetic archive label";
const missingOpponentSameKey=clone(match);missingOpponentSameKey.opponent_names=[];
const winnerConflict=clone(match);winnerConflict.winning_side=2;
const resultWithoutSets=clone(match);resultWithoutSets.games=[];
resultWithoutSets.outcome_evidence="synthetic confirmed winner";

const report=summarizeMatchReconciliation({
 current:[match],
 stage:[
  {dbv_id:match.dbv_id,source_key:match.source_key,payload:match},
  {dbv_id:idConflict.dbv_id,source_key:idConflict.source_key,payload:idConflict},
  {dbv_id:rekey.dbv_id,source_key:rekey.source_key,payload:rekey},
  {dbv_id:partial.dbv_id,source_key:partial.source_key,payload:partial},
  {dbv_id:unrelated.dbv_id,source_key:unrelated.source_key,payload:unrelated},
  {dbv_id:zeroScore.dbv_id,source_key:zeroScore.source_key,payload:zeroScore},
  {dbv_id:quarantined.dbv_id,source_key:quarantined.source_key,payload:quarantined},
  missingSameKey,metadataSameKey,missingOpponentSameKey,winnerConflict
 ],
 backup:[impostor],
 quarantine:[quarantined]
});
assert.equal(report.totals.stage,11);
assert.equal(report.totals.backup,1);
assert.equal(report.stage.canonical_same_key,1);
assert.equal(report.stage.conflicting_same_key,2);
assert.equal(report.stage.same_key_insufficient_evidence,2);
assert.equal(report.stage.same_key_metadata_difference,1);
assert.equal(report.stage.strict_rekey_candidate,1);
assert.equal(report.stage.partial_overlap_review,1);
assert.equal(report.stage.unresolved,2);
assert.equal(report.stage.already_quarantined,1);
assert.equal(report.totals.unmatched_source_keys.stage,4);
assert.equal(report.totals.unmatched_source_keys.backup,1);
assert.equal(report.totals.sport_fact_gaps,"not_determinable");
assert.equal(report.backup.unresolved,1,"identical names or event links never merge different DBV IDs");
const output=renderAggregateReport(report);
assert.match(output,/Historisches Backup/);
assert.match(output,/Teilübereinstimmung/);
assert.match(output,/Tatsächlich fehlende Sportfakten: nicht bestimmbar/);
assert.match(output,/unvollständige Belege/);
const noSets=summarizeMatchReconciliation({current:[resultWithoutSets],stage:[resultWithoutSets]});
assert.equal(noSets.stage.canonical_same_key,1,"A documented winner without set points remains valid");
for(const privatePart of ["99-000001","99-000002","Synthetic Opponent",
 "tournament:synthetic", "https://example.invalid"]){
 assert.equal(output.includes(privatePart),false,"No source data leaked to stdout");
}
assert.throws(()=>summarizeMatchReconciliation({stage:[{}],current:{}}),/Invalid/);
const year2026=report.years.stage["2026"];
assert.equal(Object.values(year2026).reduce((a,b)=>a+b,0),11);
console.log("Synthetic match audit: identity, outcome and provenance checks passed; no live network access.");
