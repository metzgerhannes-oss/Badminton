import {test,expect} from "./supabase-isolated.fixture.mjs";
const player="99-000001",access="11111111-2222-4333-8444-555555555555";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,apikey,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
const example={dbv_id:player,source_key:"tournament:synthetic-proof",category:"tournament",
 competition:"Testturnier",event:"Einzel",discipline:"Einzel",match_date:"2026-10-02",match_year:2026,
 player_side:1,winning_side:1,opponent_names:["Gegner A"],partner_names:[],
 games:[[21,12],[21,15]],source_name:"Badhub",source_kind:"third-party-match-card",
 source_url:"https://badhub.de/bwbv/turnier.php?id=123"};
async function reply(route,body){
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
 return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify(body)});
}
test("A connected player automatically receives documented private match cards without manual import",async({page})=>{
 const events=[];
 await page.addInitScript(({player,access})=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"test-access",refresh_token:"test-refresh",expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}));
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([access]));
  localStorage.setItem("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({[access]:player}));
 },{player,access});
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_owner_archive_read",route=>reply(route,null));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_archive_read",route=>{
  const args=route.request().postDataJSON();
  expect(args.p_invitation_id).toBe(access);
  expect(args.p_kind).toBe("match_card");
  const rows=[example];return reply(route,{dbv_id:player,kind:"match_card",scope_version:2,
   offset:0,total:rows.length,entries:rows});
 });
 await page.goto("/index.html#start");
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:id}})),player);
 await expect.poll(()=>page.evaluate(()=>document.querySelector("#match-stats-values")?.textContent||"")).toContain("1");
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:id}})),player);
 await expect(page.locator("#match-stats-values")).toContainText("Siege");
 const stored=await page.evaluate(()=>Object.keys(localStorage));
 expect(stored.every(key=>!key.includes("matchCardCache"))).toBe(true);
});
test("Neither an unconnected follow nor an existing v1 link gets private archive data",async({page})=>{
 let ownerCalls=0,inviteCalls=0;
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_owner_archive_read",route=>{ownerCalls++;return reply(route,null)});
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_archive_read",route=>{inviteCalls++;return reply(route,null)});
 await page.goto("/index.html#start");
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:id}})),player);
 await page.waitForTimeout(250);
 expect(ownerCalls).toBe(0);
 expect(inviteCalls).toBe(0);
 await expect(page.locator("#match-stats-values")).not.toContainText("Gegner A");
});
