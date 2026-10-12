import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [sql, jobs, names, js, html, utils]=await Promise.all([
 "database/nuliga-bwbv-league-scraper-v96.sql",
 "database/nuliga-daily-refresh-jobs-v96.sql",
 "database/nuliga-official-display-names-v96.sql",
 "teams.js","index.html","scripts/team-directory-utils.mjs"
].map(p=>readFile(p,"utf8")));
assert.match(sql,/http_get/);
assert.match(sql,/p_club_id not in \('10777','10892','10869'\)/);
assert.match(sql,/displayTyp=gesamt&displayDetail=meetings/);
assert.match(sql,/No complete Spielplan/);
assert.match(sql,/No official table/);
assert.match(sql,/make_timestamptz\(/);
assert.match(sql,/hg\+ag<>8/);
assert.match(sql,/groupMeetingReport/);
assert.match(sql,/revoke all on function private\.nuliga_clean/);
assert.doesNotMatch(sql,/Mannschaftsführer/);
assert.doesNotMatch(sql,/security definer/i);
assert.match(sql,/when '10892' then 'SG Heilbronn\/Leingarten'/);
assert.match(sql,/when '10869' then 'BSG Mannheim'/);
assert.equal((jobs.match(/cron\.schedule\(/g)||[]).length,3);
assert.equal((jobs.match(/private\.sync_nuliga_club\('/g)||[]).length,3);
assert.match(names,/official_team_name/);
assert.match(js,/official_team_name/);
assert.match(html,/id="team-official-alias"/);
assert.match(utils,/groupMeetingReport/);
console.log("nuLiga full-season import: official source, club whitelist, 3 bounded daily jobs, read-only public UI and aliases checked.");
