import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {filterTeamRows,officialTeamUrl} from "../scripts/team-directory-utils.mjs";
const files=["index.html","teams.js","teams.css","app-release.js","sw.js",
 "database/nuliga-bwbv-club-directory-v97.sql",
 "database/nuliga-club-teams-auto-discovery-v97.sql",
 "database/nuliga-discovery-refresh-batches-v97.sql",
 "database/nuliga-2025-26-archive-mapping-v97.sql",
 "database/nuliga-2025-26-archive-importer-v97.sql",
 "database/nuliga-directory-weekly-refresh-v97.sql"];
const data=Object.fromEntries(await Promise.all(files.map(async path=>[path,await readFile(path,"utf8")])));
const [html,client,css,ver,sw,dir,discover,batch,archive,archiveImporter,weekly]=files.map(f=>data[f]);
assert.match(html,/id="team-clubs-results"/);
assert.match(html,/data-page="mannschaft"/);
assert.match(client,/league_clubs\?select=id,name,region,source_url,import_state/);
assert.match(client,/offset=500/);
assert.match(client,/fetched\.length===offset/);
assert.match(client,/function renderClubDirectory\(/);
assert.match(client,/const query=normalizeTeamText/);
assert.match(css,/\.team-club-entry/);
assert.match(ver,/version:"v97"/);
assert.match(sw,/schmetterlinge-shell-v97/);
assert.match(dir,/enable row level security/);
assert.match(dir,/grant select on public\.league_clubs/);
assert.doesNotMatch(dir,/grant insert on public\.league_clubs to anon/i);
assert.match(discover,/nuLiga club is not in verified BWBV directory/);
assert.match(discover,/Official team alias not found/);
assert.match(discover,/if source_rows=0/);
assert.match(batch,/when others then/);
assert.match(batch,/p_max>4/);
assert.match(batch,/import_state='needs_review'/);
assert.match(batch,/now\(\)-interval '24 hours'/);
assert.match(archive,/2025\/26/);
assert.match(archiveImporter,/sync_nuliga_archive_team/);
assert.match(weekly,/cron\.schedule\('badminton-nuliga-club-directory-v97'/);
assert.ok(officialTeamUrl("https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10858"));
assert.equal(officialTeamUrl("https://evil.tld/wa/clubTeams?club=10858"),"");
assert.equal(filterTeamRows([{club_name:"TSG Heilbronn",official_team_name:"SG Heilbronn/Leingarten II",team_label:"II",league_name:"Württemberg-Liga",season:"2026/27"}],"leingarten","2026/27").length,1);
console.log("v97: official BWBV directory, alias-safe source import, seasonal archive and limited refresh schedules checked.");
