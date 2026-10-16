import {test,expect} from "./supabase-isolated.fixture.mjs";
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const DBV="99-000001";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Content-Type":"application/json"};
test("invited member explicitly copies sourced matches without separate player link",async({page})=>{
 await page.addInitScript(id=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"member-jwt",refresh_token:"member-refresh",
   expires_at:Date.now()+3600000,user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }));
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id,name:"Testspielerin"}],activeProfileId:id,chosen:id,friends:[],officialLinks:[]
  }));
 },DBV);
 const match={dbv_id:DBV,source_key:"test:1",match_date:"2026-10-10",
  match_year:2026,source_url:"https://example.org/match/1",
  player_side:1,winning_side:1,opponent_names:["Gegnerin"],
  partner_names:[],games:[[21,14],[21,18]],
  competition:"Test",discipline:"Einzel",source_kind:"external"};
 await page.route(API+"/**",async route=>{
  const r=route.request(),p=new URL(r.url()).pathname;
  if(r.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(p.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  if(p.endsWith("/rest/v1/player_external_match_facts"))
   return route.fulfill({status:200,headers,body:JSON.stringify([match])});
  if(p.endsWith("/rpc/app_access_trophies_read"))
   return route.fulfill({status:200,headers,body:JSON.stringify({
    player_dbv_id:DBV,scope:"app_archive",results:[]
   })});
  if(p.includes("/rpc/private_player_")||p.includes("/rpc/private_owner_")){
   // Extra player grants are deliberately rejected; app membership alone
   // must still permit a complete sourced match copy.
   return route.fulfill({status:403,headers,body:'{"message":"player grant not provided"}'});
  }
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.goto("/#einstellungen/daten",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await page.getByRole("button",{name:"Daten für ausgewählten Spieler übernehmen"}).click();
 await page.locator("#player-copy-now").click();
 await expect(page.locator("#player-copy-status")).toContainText("Übernahme abgeschlossen");
 await expect(page.locator("#player-copy-dialog")).toBeHidden();
 const saved=await page.evaluate(id=>{
  const value=JSON.parse(localStorage.getItem("schmetterlinge.consentedPlayerData.v1")||"{}");
  return value[id]?.matches?.map(x=>x.source_key);
 },DBV);
 expect(saved).toEqual(["test:1"]);
 // Reopening and closing the dialog must not erase the device copy.
 await page.getByRole("button",{name:"Daten für ausgewählten Spieler übernehmen"}).click();
 await expect(page.locator("#player-copy-dialog")).toBeVisible();
 await expect(page.locator("#player-copy-later")).toHaveText("Schließen");
 await expect(page.locator("#player-copy-summary")).toContainText("1 Matchkarten");
 await page.locator("#player-copy-later").click();
 await expect(page.locator("#player-copy-dialog")).toBeHidden();
 // The mock denies all player-only grants, so this result proves that
 // existing app membership suffices for the voluntary data copy.
});
