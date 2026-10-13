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
 expect(accepted).toBe(0);
 await page.locator("#player-invite-accept").click();
 await expect(page.locator("#player-invite-data")).toBeVisible();
 await expect(page.locator("#player-invite-name")).toContainText("Muster <img");
 expect(await page.locator("#player-invite-name img").count()).toBe(0);
 expect(await page.locator("#player-invite-matches li").count()).toBe(30);
 expect(await page.locator("#player-invite-matches a").count()).toBe(29);
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
