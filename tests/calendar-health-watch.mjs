import assert from "node:assert/strict";
import {assessCalendarHealth} from "../scripts/calendar-health-watch.mjs";

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
