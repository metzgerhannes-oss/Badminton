import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {searchInvitationPlayers} from "../scripts/invitation-search.mjs";

const [html,app,searchUi,welcome,styles,worker,release]=await Promise.all([
 "index.html","app.js","player-profile-search.js","welcome.js","styles.css","sw.js","app-release.js"
].map(p=>readFile(p,"utf8")));
for(const id of ["own-player-search","own-player-search-input","own-player-search-status","own-player-search-results"]){
 assert.ok(html.includes('id="'+id+'"'),"Profile search requires "+id);
}
assert.match(html,/<script type="module" src="\.\/player-profile-search\.js">/);
assert.match(app,/playerDialog\.showModal\(\);\s*window\.dispatchEvent\(new CustomEvent\("badminton:own-profile-form-open"/);
assert.match(searchUi,/section\.hidden=Boolean\(event\.detail\?\.editing\)/);
assert.match(searchUi,/savedCandidates:\[\]/,"Existing family surname must not hide other players");
assert.match(welcome,/searchInvitationPlayers\(term,\{signal:searchController\.signal,savedCandidates:\[\]\}\)/,"Welcome must search the full DBV index, not only previously saved family members");
assert.match(searchUi,/controller\?\.abort\(\)/,"Previous requests must cancel");
assert.match(searchUi,/hit\.type="button"/,"Selecting a candidate must not submit the form");
assert.match(searchUi,/form\.elements\.namedItem\("id"\)\.value=player\.id/);
assert.match(searchUi,/hit\.disabled=true/,"Duplicate players must not be added");
assert.match(styles,/#own-player-search\[hidden\]\{display:none!important\}/);
assert.match(worker,/schmetterlinge-shell-v161/);
assert.match(worker,/\.\/player-profile-search\.js/);
assert.match(release,/version:"v161"/);

// Fake network only. No request in these tests may reach production Supabase.
const synthetic=[
 {dbv_id:"05-101001",name:"Lena Muster",club:"Demo-Verein Nord",age_class:"U13"},
 {dbv_id:"05-101002",name:"Nils Muster",club:"Demo-Verein Süd",age_class:"U15"}
];
let calls=0;
const fetchImpl=async (url,options)=>{
 calls++;
 assert.ok(String(url).endsWith("/rpc/search_dbv_player_identity"));
 assert.equal(JSON.parse(options.body).p_query,"Muster");
 assert.equal(options.method,"POST");
 return {ok:true,json:async()=>synthetic};
};
const found=await searchInvitationPlayers("Muster",{fetchImpl,savedCandidates:[]});
assert.equal(calls,1);
assert.deepEqual(found.players.map(p=>p.id),["05-101001","05-101002"]);
assert.equal(found.source,"dbv");
const before=calls;
assert.deepEqual((await searchInvitationPlayers("Mu",{fetchImpl})).players,[]);
assert.equal(calls,before,"Too-short queries must not touch the network");
const restricted=await searchInvitationPlayers("Muster",{
 fetchImpl:async()=>({ok:false,status:403}),savedCandidates:[]
});
assert.equal(restricted.source,"restricted");
console.log("Own-profile search: two synthetic family-name hits, duplicate guard, abort, no live database test and v161 shell verified.");
