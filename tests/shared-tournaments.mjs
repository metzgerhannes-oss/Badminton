import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {communityPath,sharedItems,sharedRecord,sharePayload,sharedKey,publicationGrantPath,hasPublicationGrant} from "../scripts/shared-tournaments.mjs";

const player="05-070879",other="05-071969";
assert.equal(communityPath("local-001"),null);
const url=new URL("https://example.test/rest/v1/"+communityPath(player));
assert.equal(url.searchParams.get("player_dbv_id"),"eq."+player);
assert.equal(url.pathname.endsWith("/shared_tournament_hints"),true);
assert.equal(url.searchParams.has("is_shared"),false);
assert.equal(url.searchParams.get("limit"),"20");
assert.doesNotMatch(url.searchParams.get("select"),/user_id|email|is_default/);
const tournamentId="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const entry={player_dbv_id:player,external_tournament_id:tournamentId,title:"Test-Turnier",
 start_date:"2026-12-03",end_date:"2026-12-04"};
assert.equal(sharedRecord(entry).url,"https://dbv.turnier.de/tournament/"+tournamentId);
assert.equal(sharedRecord({...entry,external_tournament_id:"javascript:alert(1)"}),null);
assert.equal(sharedRecord({...entry,player_dbv_id:"invalid"}),null);
const items=sharedItems([entry,entry,{...entry,player_dbv_id:other},
 {...entry,external_tournament_id:"D8CD3204-A1E7-4FDD-8DFA-61E774288AF2",start_date:"2026-01-01",end_date:"2026-01-02"}
],player,"2026-11-30");
assert.equal(items.length,1);
assert.equal(items[0].id,tournamentId);
assert.equal(items[0].source,"community");
const body=sharePayload({id:tournamentId,playerId:player,name:"Baden Masters",
 startDate:"2026-12-03",endDate:"2026-12-04"},"2980046b-abd4-4056-b275-090a7364c4ac");
assert.equal(body.player_dbv_id,player);
assert.equal(body.external_tournament_id,tournamentId);
assert.equal(body.is_shared,true);
assert.match(body.shared_at,/^\d{4}-\d\d-\d\dT/);
assert.ok(!("player_name" in body)&&!("friends" in body),"Never upload private family profiles");
assert.equal(sharedKey({id:tournamentId,playerId:player}),player+"|"+tournamentId);
assert.throws(()=>sharePayload({...body,playerId:"all"},body.user_id),/Spielerprofil/);
assert.throws(()=>sharePayload({id:tournamentId,playerId:player,name:"x"},body.user_id),/Turniernamen/);
assert.throws(()=>sharePayload({...body,playerId:player,id:tournamentId,name:"Test",startDate:"2026-12-05",endDate:"2026-12-01"},body.user_id),/Turnierende/);

const [app,html,sw,js,css,db,projection]=await Promise.all([
 "app.js","index.html","sw.js","shared-tournaments.js","app-shell.css","database/shared-tournament-links-v87.sql","database/shared-tournament-projection-v88.sql"
].map(p=>readFile(p,"utf8")));
assert.match(html,/id="tournament-share"[^>]*name="publicShare"/);
assert.match(html,/id="shared-tournaments"/);
assert.match(html,/id="community-sync-status"/);
assert.match(html,/src="\.\/shared-tournaments\.js"/);
assert.match(sw,/"\.\/shared-tournaments\.js"/);
assert.match(sw,/"\.\/scripts\/shared-tournaments\.mjs"/);
assert.match(app,/badminton:share-tournament/);
assert.match(js,/auth\/v1\//);
assert.match(js,/gotrue_meta_security/);
assert.match(js,/bearer|Bearer/);
assert.match(js,/Deine Follower können es sehen/);
assert.match(js,/Nutzerhinweis \(unbestätigt\)/);
assert.doesNotMatch(js,/service_role|private_key|SUPABASE_SERVICE/);
assert.match(css,/\.shared-event-row/);
assert.match(db,/ENABLE ROW LEVEL SECURITY|Public opt-in reported tournament hints/);
// Existing RLS remains, and anonymous clients may read only whitelisted fields.
assert.match(db,/GRANT SELECT \(player_dbv_id, external_tournament_id/);
assert.match(projection,/CREATE TABLE IF NOT EXISTS public.shared_tournament_hints/);
assert.match(projection,/REVOKE SELECT ON public.user_tournament_links FROM anon/);
assert.match(projection,/DROP POLICY IF EXISTS "Public opt-in reported tournament hints"/);
assert.match(projection,/REVOKE ALL ON SCHEMA private/);
assert.match(db,/AS RESTRICTIVE FOR INSERT TO authenticated/);
assert.doesNotMatch(db,/GRANT INSERT[^;]*TO anon/);
console.log("v88 shared tournaments: validated links, opt-in, private-profile isolation, publisher ownership, safe follower read.");

const accountId="2980046b-abd4-4056-b275-090a7364c4ac";
const verifiedPath=publicationGrantPath(accountId,player);
assert.ok(verifiedPath?.startsWith("player_publication_grants?"));
const grantUrl=new URL("https://example.test/rest/v1/"+verifiedPath);
assert.equal(grantUrl.searchParams.get("user_id"),"eq."+accountId);
assert.equal(grantUrl.searchParams.get("player_dbv_id"),"eq."+player);
assert.equal(grantUrl.searchParams.get("verified_at"),"not.is.null");
assert.equal(grantUrl.searchParams.get("revoked_at"),"is.null");
assert.equal(publicationGrantPath("invalid",player),null);
assert.equal(publicationGrantPath(accountId,"invalid"),null);
assert.equal(hasPublicationGrant([],player),false);
assert.equal(hasPublicationGrant([{player_dbv_id:other}],player),false);
assert.equal(hasPublicationGrant([{player_dbv_id:player}],player),true);
const [grantSql,frontend]=await Promise.all([
 readFile("database/verified-player-publication-v90.sql","utf8"),
 readFile("shared-tournaments.js","utf8")
]);
assert.match(grantSql,/CREATE TABLE IF NOT EXISTS public\.player_publication_grants/);
assert.match(grantSql,/REVOKE ALL ON public\.player_publication_grants FROM PUBLIC, anon, authenticated/);
assert.match(grantSql,/AS RESTRICTIVE\s+FOR INSERT TO authenticated/);
assert.match(grantSql,/AS RESTRICTIVE\s+FOR UPDATE TO authenticated/);
assert.match(grantSql,/g\.user_id = \(SELECT auth\.uid\(\)\)/);
assert.match(grantSql,/g\.revoked_at IS NULL/);
assert.match(grantSql,/AFTER INSERT OR UPDATE OR DELETE ON public\.player_publication_grants/);
assert.match(frontend,/hasPublicationGrant\(grants,bookmark.playerId\)/);
assert.match(frontend,/noch keine geprüfte Veröffentlichungsberechtigung/);
console.log("v90: verified per-player publisher authorization is required, denied sessions cannot post.");
