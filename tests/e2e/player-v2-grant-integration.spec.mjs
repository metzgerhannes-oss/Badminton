import {test,expect} from "@playwright/test";
const ID="99-111111",INVITE="11111111-2222-4333-8444-555555555555";
const TOKEN="0123456789abcdef".repeat(4);
const HEADERS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"POST,OPTIONS"};
const ok=(route,payload)=>route.fulfill({status:200,contentType:"application/json",headers:HEADERS,body:JSON.stringify(payload)});
function setup(page,{v2=true}={}){
 const seen={accepted:0,ownerRead:0,inviteRead:0,trophyRead:0,matchRead:0,violations:[]};
 return page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:HEADERS});
  if(url.pathname==="/auth/v1/signup")return ok(route,{
   access_token:"test-access",refresh_token:"test-refresh",expires_in:86400,
   user:{id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}
  });
  if(url.pathname==="/rest/v1/rpc/private_player_invite_accept"){
   seen.accepted++;return ok(route,INVITE);
  }
  if(url.pathname==="/rest/v1/rpc/private_player_access_read"){
   seen.inviteRead++;
   return ok(route,{player:{dbv_id:ID,name:"Beispielspieler",club:"Musterverein",age_class:"U13"}});
  }
  if(url.pathname==="/rest/v1/rpc/private_owner_trophies_read"){
   seen.ownerRead++;return ok(route,null);
  }
  if(url.pathname==="/rest/v1/rpc/private_player_trophies_read"){
   seen.trophyRead++;
   const args=JSON.parse(route.request().postData()||"{}");
   expect(args.p_invitation_id).toBe(INVITE);
   return ok(route,v2?{
    player_dbv_id:ID,coverage:"partial_not_exhaustively_verified",
    results:[{id:"event-medal-1",playerId:ID,verified:true,date:"2026-10-03",
     place:3,event:"Belegtes Turnier",discipline:"Einzel",ageGroup:"U13",
     source:{url:"https://dbv.turnier.de/tournament/01234567-0123-4123-8123-012345678901"}}]
   }:null);
  }
  if(url.pathname==="/rest/v1/rpc/private_player_archive_read"){
   seen.matchRead++;
   const args=JSON.parse(route.request().postData()||"{}");
   expect(args.p_invitation_id).toBe(INVITE);
   return ok(route,v2?{
    dbv_id:ID,kind:"match_card",scope_version:2,total:1,offset:0,
    entries:[{dbv_id:ID,source_key:"source-match-1",match_year:2026,match_date:"2026-10-03",
     category:"tournament",competition:"Belegtes Turnier",discipline:"Einzel",
     event:"Einzel U13",round_label:"Vorrunde",source_kind:"source-evidence",
     source_name:"Turnierbeleg",outcome_evidence:"verified-sets",player_side:1,winning_side:1,
     opponent_names:["Gegner"],partner_names:[],games:[[21,17],[21,16]],
     source_url:"https://dbv.turnier.de/tournament/01234567-0123-4123-8123-012345678901"}]
   }:null);
  }
  if(url.pathname.includes("/rpc/private_player_owner_archive_read"))return ok(route,null);
  if(url.pathname.includes("/rest/v1/players")||url.pathname.includes("/rest/v1/tournament_placements")){
   seen.violations.push(url.pathname);return ok(route,[]);
  }
  return ok(route,[]);
 }).then(()=>seen);
}
async function accept(page){
 await page.goto("/private-player.html#token="+TOKEN,{waitUntil:"load"});
 await expect(page.locator("#player-invite-accept")).toBeVisible();
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-name")).toContainText("Beispielspieler");
 await page.locator("#player-invite-open-app").click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 await expect(page.locator(".focused-profile")).toContainText("Beispielspieler");
}
test("New v2 accepted link unlocks only this player's sourced trophy and match in main app",async({page})=>{
 const seen=await setup(page,{v2:true});
 await accept(page);
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".trophy-award")).toHaveCount(1);
 await expect(page.locator(".trophy-award")).toContainText(["3. Platz"]);
 await expect(page.locator("#history-source")).toContainText("Teilarchiv");
 await expect.poll(()=>seen.matchRead,{timeout:10000}).toBeGreaterThan(0);
 expect(seen.accepted).toBe(1);
 expect(seen.inviteRead).toBeGreaterThan(0);
 expect(seen.trophyRead).toBeGreaterThan(0);
 expect(seen.violations).toEqual([]);
 const data=await page.evaluate(()=>({
  own:JSON.parse(localStorage.getItem("shuttleboard-v1")).players,
  followed:JSON.parse(localStorage.getItem("shuttleboard-v1")).friends,
  accepted:JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3"))
 }));
 expect(data.own).toHaveLength(0);
 expect(data.followed).toHaveLength(1);
 expect(data.accepted).toContain(INVITE);
});
test("Old v1 accepted link never obtains a trophy or an authorized match archive",async({page})=>{
 const seen=await setup(page,{v2:false});
 await accept(page);
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#history-source")).toContainText("geschützt");
 await expect(page.locator(".trophy-award")).toHaveCount(0);
 await expect.poll(()=>seen.matchRead,{timeout:10000}).toBeGreaterThan(0);
 expect(seen.accepted).toBe(1);
 expect(seen.violations).toEqual([]);
});
