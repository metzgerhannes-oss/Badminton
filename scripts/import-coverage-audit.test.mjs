import assert from "node:assert/strict";
import {makeReport,diagnosis,printReport,publicSummary} from "./import-coverage-audit.mjs";

const time=Date.parse("2026-10-10T15:00:00Z");
const verified={dbv_id:"99-000001",source_key:"ok",category:"tournament",
 discipline:"Einzel",match_year:2026,player_side:1,winning_side:1,
 opponent_names:["Testgegner"],games:[[21,12],[21,17]],
 source_url:"https://badhub.de/bwbv/turnier.php?id=123"};
const history=[{dbv_id:"99-000001",status:"partial"},
 {dbv_id:"99-000002",status:"awaiting_source"},
 {dbv_id:"99-000003",status:"queued"}];
const jobs=[{dbv_id:"99-000001",status:"complete",cursor_offset:5,verified_count:5,
 last_started_at:"2026-10-01T00:00:00Z"},
 {dbv_id:"99-000002",status:"awaiting_source",cursor_offset:0,
  verified_count:0,last_started_at:"2026-10-01T00:00:00Z"}];
const report=makeReport(history,jobs,[verified],{now:time});
assert.equal(report.players,3);
assert.equal(report.history_jobs,3);
assert.equal(report.match_jobs,2);
assert.equal(report.stored,1);
assert.equal(report.countable,1);
assert.equal(report.items.find(x=>x.dbv_id==="99-000001").finding,"batch_scope_not_comparable");
assert.equal(report.items.find(x=>x.dbv_id==="99-000002").finding,"source_unavailable");
assert.equal(report.items.find(x=>x.dbv_id==="99-000003").finding,"not_started");
const message=printReport(report,{history:false,imports:false,facts:false});
assert.match(message,/Tatsächlich gespeicherte Quellkarten: 1/);
assert.doesNotMatch(message,/99-000001|99-000002|99-000003/);
assert.doesNotMatch(message,/\b\d{2}-\d{6}\b/);
assert.equal(publicSummary(report,{}).items,undefined);
assert.equal(publicSummary(report,{}).grouped.batch_scope_not_comparable,1);
assert.doesNotMatch(message,/Testgegner/);
assert.equal(diagnosis({status:"loading",lease_until:"2026-10-10T13:00:00Z"},
 true,0,0,time),"expired_lease");
assert.equal(diagnosis({status:"partial",cursor_offset:20,verified_count:200,
 last_started_at:"2026-10-09T00:00:00Z"},true,20,20,time),"batch_scope_not_comparable");
assert.equal(diagnosis({status:"complete",cursor_offset:2,verified_count:2},
 true,2,2,time),"not_proven_complete");
assert.equal(diagnosis({status:"complete",verified_count:2,cursor_offset:2},
 true,12,12,time),"batch_scope_not_comparable",
 "Retained facts can exceed the most recent batch without a stale-import claim");
assert.equal(diagnosis({status:"complete",verified_count:120,cursor_offset:120},
 true,12,12,time),"batch_scope_not_comparable",
 "A smaller lifetime subset is not proven missing by a batch-only count");
assert.match(printReport(report,{facts:true}),/Stichprobe gekappt/);
console.log("Offline coverage audit: only aggregate counts, no DBV IDs or private rows.");
