import assert from "node:assert/strict";
import {assessCalendarHealth,assessPagesHealth} from "../scripts/calendar-health-watch.mjs";

const now=new Date("2026-10-13T08:00:00Z");
const good={source:"https://turniere.badminton.de/",capturedAt:"2026-10-13T05:40:00Z",
 entries:[{source_key:"fixture-1",start_date:"2026-12-04"},{source_key:"fixture-2",start_date:"2027-04-03"}]};
const runs=[{head_branch:"main",event:"schedule",status:"completed",conclusion:"success",created_at:"2026-10-13T05:37:00Z"}];
const check=(snapshot=good,history=runs)=>assessCalendarHealth(snapshot,history,now);
assert.deepEqual(check().problems,[]);
assert.equal(check().entryCount,2);
assert.deepEqual(check().byYear,{"2026":1,"2027":1});
assert.match(check({...good,capturedAt:"2026-10-09T05:40:00Z"}).problems.join(" "),/älter als 72/);
assert.match(check({...good,entries:[]}).problems.join(" "),/leer/);
assert.match(check(good,[{...runs[0],conclusion:"failure"}]).problems.join(" "),/nicht erfolgreich/);
assert.match(check(good,[]).problems.join(" "),/Kein abgeschlossener/);
assert.deepEqual(check(good,[{...runs[0],event:"pull_request",conclusion:"failure"},...runs]).problems,[]);
assert.deepEqual(check(good,[{...runs[0],status:"in_progress"},...runs]).problems,[]);
assert.match(check(good,[{...runs[0],created_at:"2026-10-09T03:00:00Z"}]).problems.join(" "),/72 Stunden/);
console.log("Ops calendar health watch: fresh, failed, missing, stale and PR-only scenarios validated.");

const pagesRun={id:123,name:"pages build and deployment",head_branch:"main",
 event:"push",status:"completed",conclusion:"success",created_at:"2026-10-13T06:00:00Z",
 head_sha:"0000000000000000000000000000000000000000"};
const okJobs=["build","deploy","report-build-status"].map(name=>
 ({name,status:"completed",conclusion:"success"}));
assert.deepEqual(assessPagesHealth([pagesRun],okJobs).problems,[]);
assert.equal(assessPagesHealth([pagesRun],okJobs).runId,123);
assert.match(assessPagesHealth([],okJobs).problems.join(" "),/Kein abgeschlossenes/);
assert.match(assessPagesHealth([{...pagesRun,conclusion:"failure"}],okJobs).problems.join(" "),/fehlgeschlagen/);
assert.match(assessPagesHealth([pagesRun],okJobs.slice(0,2)).problems.join(" "),/report-build-status/);
assert.match(assessPagesHealth([pagesRun],okJobs.map(j=>
 j.name==="deploy"?{...j,conclusion:"failure"}:j)).problems.join(" "),/deploy/);
assert.deepEqual(assessPagesHealth([
 {...pagesRun,id:124,created_at:"2026-10-13T07:00:00Z",conclusion:"cancelled"},
 pagesRun
],okJobs).problems,[],"Superseded cancelled deployments do not raise alerts");
assert.match(assessPagesHealth([
 {...pagesRun,id:125,created_at:"2026-10-13T07:00:00Z",conclusion:"failure"},
 pagesRun
],okJobs).problems.join(" "),/fehlgeschlagen/,
 "Latest failed deployment must never be masked by earlier successful run");
assert.deepEqual(assessPagesHealth([
 {...pagesRun,head_branch:"feature/test",created_at:"2026-10-14T07:00:00Z",conclusion:"failure"},
 pagesRun
],okJobs).problems,[],"Unrelated branch failures must not flag production");
