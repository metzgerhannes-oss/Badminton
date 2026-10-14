import {test,expect} from "@playwright/test";
const token="0123456789abcdef".repeat(4);
const id="11111111-2222-4333-8444-555555555555";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,apikey,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
async function cors(route,body){
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
 return route.fulfill({status:200,contentType:"application/json",headers,body:JSON.stringify(body)});
}
test("Unusable tokens never reveal a profile and fragments are immediately cleared",async({page})=>{
 await page.goto("/private-player.html#token=not-a-token",{waitUntil:"load"});
 await expect(page.locator("#player-invite-status")).toContainText("keine angenommene Einladung");
 await expect(page.locator("#player-invite-data")).toBeHidden();
 expect(new URL(page.url()).hash).toBe("");
});
test("Seven-day invite must be accepted, then persistent scoped session works until server revocation",async({page})=>{
 let accepted=0,reads=0,revoked=false;
 await page.route("**/*.supabase.co/auth/v1/signup",route=>cors(route,{
  access_token:"test-access",refresh_token:"test-refresh",expires_in:86400,
  user:{id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}
 }));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_invite_accept",route=>{
  if(route.request().method()==="OPTIONS")return cors(route,null);
  accepted++;
  expect(JSON.parse(route.request().postData()||"{}").p_token).toBe(token);
  expect(route.request().headers().authorization).toBe("Bearer test-access");
  expect(route.request().url()).not.toContain(token);
  return cors(route,id);
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_access_read",route=>{
  if(route.request().method()==="OPTIONS")return cors(route,null);
  reads++;
  expect(JSON.parse(route.request().postData()||"{}").p_invitation_id).toBe(id);
  expect(route.request().headers().authorization).toBe("Bearer test-access");
  return cors(route,revoked?null:{player:{
   dbv_id:"99-000001",name:"Muster <img src=x onerror=alert(1)>",club:"Musterverein",age_class:"U13"
  },matches:Array.from({length:35},(_,i)=>({
   match_date:"2026-10-10",discipline:"Einzel",competition:"Test",
   player_side:1,winning_side:2,source_name:"Beleg",
   source_url:i===0?"javascript:alert(1)":"https://badhub.de/spieler/99-000001"
  }))});
 });
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 expect(new URL(page.url()).hash).toBe("");
 await expect(page.locator("#player-invite-data")).toBeHidden();
 await expect(page.locator("#player-invite-accept")).toBeVisible();
 await expect(page.locator("#player-invite-open-app")).toBeVisible();
 expect(accepted).toBe(0);
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-data")).toBeVisible();
 await expect(page.locator("#player-invite-name")).toContainText("Muster <img");
 expect(await page.locator("#player-invite-name img").count()).toBe(0);
 await expect(page.locator("#player-invite-open-app")).toBeVisible();
 await expect(page.locator("#player-invite-open-app")).toHaveAttribute("href","./index.html#start");
 await expect(page.locator("#player-invite-data")).not.toContainText("Belegte Spiele");
 await expect(page.locator("#player-invite-matches")).toHaveCount(0);
 expect(accepted).toBe(1);
 // Opening the same accepted link on this device must not redeem its token again.
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 await expect(page.locator("#player-invite-data")).toBeVisible();
 await expect(page.locator("#player-invite-status")).toContainText("bereits angenommener Spielerzugang");
 await expect(page.locator("#player-invite-accept")).toHaveText("Weitere Einladung annehmen");
 expect(new URL(page.url()).hash).toBe("");
 expect(accepted).toBe(1);
 await page.reload();
 await expect(page.locator("#player-invite-data")).toBeVisible();
 expect(accepted).toBe(1);
 expect(reads).toBeGreaterThanOrEqual(2);
 // The server has revoked an already redeemed invite: next read returns no data.
 revoked=true;
 await page.reload();
 await expect(page.locator("#player-invite-data")).toBeHidden();
 await expect(page.locator("#player-invite-status")).toContainText("Kein Zugriff");
 expect(accepted).toBe(1);
});
test("Expired or previously accepted token cannot enroll another device",async({page})=>{
 await page.route("**/*.supabase.co/auth/v1/signup",route=>cors(route,{
  access_token:"test-access",refresh_token:"test-refresh",expires_in:86400,
  user:{id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}
 }));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_invite_accept",route=>cors(route,null));
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-data")).toBeHidden();
 await expect(page.locator("#player-invite-status")).toContainText("nicht mehr annehmbar");
});


test("Temporary accept/read failures retain the private invite token and accepted device access",async({page})=>{
 let failAccept=true,failRead=false;
 await page.route("**/*.supabase.co/auth/v1/signup",route=>cors(route,{
  access_token:"test-access",refresh_token:"test-refresh",expires_in:86400,
  user:{id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}
 }));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_invite_accept",route=>{
  if(route.request().method()==="OPTIONS")return cors(route,null);
  if(failAccept){failAccept=false;return route.abort("failed")}
  return cors(route,id);
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_access_read",route=>{
  if(route.request().method()==="OPTIONS")return cors(route,null);
  if(failRead)return route.abort("failed");
  return cors(route,{player:{dbv_id:"99-000001",name:"Spieler nach Retry",club:"Testverein"},
   matches:[]});
 });
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 await expect(page.locator("#player-invite-accept")).toBeVisible();
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-status")).toContainText("Annahme konnte nicht bestätigt");
 await expect(page.locator("#player-invite-accept")).toBeEnabled();
 await expect(page.locator("#player-invite-accept")).toBeVisible();
 expect(new URL(page.url()).hash).toBe("");
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-name")).toContainText("Spieler nach Retry");
 failRead=true;
 await page.reload({waitUntil:"load"});
 await expect(page.locator("#player-invite-status")).toContainText("gespeicherte Freigabe bleibt");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3")));
 expect(saved).toContain(id);
 failRead=false;
 await page.reload({waitUntil:"load"});
 await expect(page.locator("#player-invite-name")).toContainText("Spieler nach Retry");
});

test("Transient session refresh failure must not erase accepted identity or refresh token",async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"old-access",refresh_token:"keep-refresh",user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",expires_at:Date.now()-1000
  }));
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify(["11111111-2222-4333-8444-555555555555"]));
 });
 await page.route("**/*.supabase.co/auth/v1/token?*",route=>route.abort("failed"));
 await page.goto("/private-player.html",{waitUntil:"load"});
 await expect(page.locator("#player-invite-status")).toContainText("gespeicherte Freigabe bleibt");
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communitySession.v1")));
 expect(session.refresh_token).toBe("keep-refresh");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3")));
 expect(saved).toContain(id);
});


test("Private invitation start has a prominent app link without requiring acceptance or transferring a grant",async({page})=>{
 await page.goto("/private-player.html#token=not-a-token",{waitUntil:"load"});
 const entry=page.locator("#player-invite-open-app");
 await expect(entry).toBeVisible();
 await expect(entry).toContainText("Schmetterlinge-App öffnen");
 await expect(page.getByText("Belegte Spiele")).toHaveCount(0);
 await expect(page.locator("#player-invite-data")).toBeHidden();
 const before=await page.evaluate(()=>localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3"));
 expect(before).toBeNull();
 await entry.click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 const after=await page.evaluate(()=>localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3"));
 expect(after).toBeNull();
});


test("Accepted invitation preloads one followed DBV player and bypasses fresh-own-profile onboarding",async({page})=>{
 await page.route("**/*.supabase.co/auth/v1/signup",route=>cors(route,{
  access_token:"test-access",refresh_token:"test-refresh",expires_in:86400,
  user:{id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}
 }));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_invite_accept",route=>cors(route,id));
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_access_read",route=>cors(route,{
  player:{dbv_id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birth_year:2016,age_class:"U13"},
  matches:[]
 }));
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 await expect(page.locator("#player-invite-accept")).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
 expect(before).toBeNull();
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-name")).toContainText("Philipp Metzger");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players??[]).toHaveLength(0);
 expect(saved.friends).toHaveLength(1);
 expect(saved.friends[0]).toMatchObject({
  id:"05-070879",name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen"
 });
 await page.locator("#player-invite-open-app").click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 await expect(page.locator(".focused-profile")).toContainText("Philipp Metzger");
 await expect(page.locator(".focused-profile")).toContainText("Du folgst");
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator(".focused-profile")).toContainText("Philipp Metzger");
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
});
