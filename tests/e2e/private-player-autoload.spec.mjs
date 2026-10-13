import {test,expect} from "@playwright/test";
const access="11111111-2222-4333-8444-555555555555";
const player="99-000001";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,apikey,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
async function mockArchive(route,{revoked=false,legacy=false}={}){
 if(route.request().method()==="OPTIONS")
  return route.fulfill({status:204,headers,body:""});
 const request=route.request();
 expect(request.headers().authorization).toBe("Bearer test-access");
 const args=request.postDataJSON();
 expect(args.p_invitation_id).toBe(access);
 expect(args.p_limit).toBe(100);
 expect(args.p_offset).toBe(0);
 const kind=args.p_kind;
 const entries=kind==="placement"
  ?[{id:"a1",playerId:player,playerName:"Muster",place:1,verified:true,
    date:"2026-10-03",event:"Belegturnier",discipline:"Einzel",ageGroup:"U13",
    source:{url:"https://dbv.turnier.de/tournament/example"}}]
  :[{dbv_id:player,source_key:"test-card",category:"tournament",
    competition:"Belegturnier",event:"Einzel",discipline:"Einzel",
    match_date:"2026-10-03",match_year:2026,player_side:1,winning_side:1,
    opponent_names:["Gegner A"],partner_names:[],games:[[21,12],[21,15]],
    source_name:"Badhub",source_kind:"third-party-match-card",
    source_url:"https://badhub.de/bwbv/turnier.php?id=123"}];
 return route.fulfill({status:200,headers,contentType:"application/json",
  body:JSON.stringify(revoked||legacy?null:{
   dbv_id:player,kind,scope_version:2,total:entries.length,offset:0,entries,
   coverage:"source_evidence_not_exhaustively_verified"
  })});
}
test("Accepted v2 link automatically supplies one player's trophies and match cards",async({page})=>{
 await page.addInitScript(({access})=>{
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([access]));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"test-access",refresh_token:"test-refresh",expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}));
  window.__privateSeen=[];
  window.addEventListener("badminton:private-evidence",e=>window.__privateSeen.push(e.detail));
 },{access});
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_archive_read",route=>mockArchive(route));
 await page.goto("/index.html#start");
 await page.evaluate(playerId=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId}})),player);
 await expect.poll(()=>page.evaluate(()=>window.__privateSeen.some(x=>x.playerId==="99-000001"&&
  x.status==="ready"&&x.matchesLoading===false&&x.placements?.length===1&&x.matches?.length===1))).toBe(true);
 await page.evaluate(playerId=>window.renderHistory?.(playerId,[{id:playerId,name:"Muster"}],{mode:"friend"}),player);
 await expect(page.locator("#trophy-awards")).toContainText("Belegturnier");
 await page.evaluate(playerId=>window.renderDashboard?.(playerId,[{id:playerId,name:"Muster"}],[],{mode:"friend"}),player);
 await expect(page.locator(".home-trophy")).toContainText("1");
});
test("A local follow or a legacy link alone cannot unlock archived data",async({page})=>{
 let calls=0;
 await page.addInitScript(()=>{
  window.__privateSeen=[];
  window.addEventListener("badminton:private-evidence",e=>window.__privateSeen.push(e.detail));
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_archive_read",route=>{
  calls++;return mockArchive(route,{legacy:true});
 });
 await page.goto("/index.html#start");
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:"99-000001"}})));
 await expect.poll(()=>page.evaluate(()=>window.__privateSeen.some(x=>x.status==="not_connected"))).toBe(true);
 expect(calls).toBe(0);
 await expect(page.locator(".home-trophy")).not.toContainText("Belegturnier");
});
test("Revocation clears existing private award and match evidence from the app",async({page})=>{
 let revoked=false;
 await page.addInitScript(({access})=>{
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([access]));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"test-access",refresh_token:"test-refresh",expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}));
  window.__privateSeen=[];
  window.addEventListener("badminton:private-evidence",e=>window.__privateSeen.push(e.detail));
 },{access});
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_archive_read",route=>mockArchive(route,{revoked}));
 await page.goto("/index.html#start");
 await page.evaluate(playerId=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId}})),player);
 await expect.poll(()=>page.evaluate(()=>window.__privateSeen.some(x=>x.status==="ready"&&x.matchesLoading===false))).toBe(true);
 revoked=true;
 await page.evaluate(playerId=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId}})),player);
 await expect.poll(()=>page.evaluate(()=>window.__privateSeen.some(x=>x.status==="no_trophy_scope"))).toBe(true);
 const latest=await page.evaluate(()=>window.__privateSeen.at(-1));
 expect(latest.status).toBe("no_trophy_scope");
 expect(latest.placements).toBeUndefined();
});
