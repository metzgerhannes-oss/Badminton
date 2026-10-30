import {test,expect} from "./supabase-isolated.fixture.mjs";

const PLAYER="99-900001",FRIEND="99-900002";
const TOURNAMENT="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const AUTH_USER="2980046b-abd4-4056-b275-090a7364c4ac";
const headers={"Access-Control-Allow-Origin":"*","Content-Type":"application/json",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS"};

test("Opt-in shared event becomes visible on follower device and can be revoked",async ({browser})=>{
 const publicRows=[];
 const publisher=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const follower=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const owner=await publisher.newPage(),reader=await follower.newPage();
 const storeA={players:[{id:PLAYER,name:"Testkind A",birthYear:2016}],
  activeProfileId:PLAYER,chosen:PLAYER,officialLinks:[],friends:[]};
 const storeB={players:[{id:FRIEND,name:"Testkind B",birthYear:2014}],
  activeProfileId:FRIEND,chosen:FRIEND,officialLinks:[],
  friends:[{id:PLAYER,name:"Testkind A",birthYear:2016}]};
 await publisher.addInitScript(s=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify(s));
  // This existing authenticated identity is independently approved for PLAYER.
  // A guest visitor must not be automatically signed up merely to try a public write.
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   user_id:"2980046b-abd4-4056-b275-090a7364c4ac",
   access_token:"test.token.session",refresh_token:"test.refresh",expires_at:Date.now()+3600000
  }));
 },storeA);
 await follower.addInitScript(s=>{localStorage.setItem("shuttleboard-v1",JSON.stringify(s));localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3",access_token:"test.follower.member",refresh_token:"test.follower.refresh",expires_at:Date.now()+3600000}));},storeB);
 let written=null;
 const mock=async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  if(url.hostname==="127.0.0.1")return route.continue();
  if(method==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.pathname==="/rest/v1/rpc/app_access_status")return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
   if(url.pathname==="/auth/v1/signup"&&method==="POST")
   throw Error("Public sharing must never create a new anonymous Auth account");
  // This positive two-device scenario simulates a prior independent guardian/club approval.
  // A separate negative test proves that missing grants block the POST entirely.
  if(url.pathname==="/rest/v1/player_publication_grants"){
   const allowed=url.searchParams.get("user_id")==="eq."+AUTH_USER&&
    url.searchParams.get("player_dbv_id")==="eq."+PLAYER;
   return route.fulfill({status:200,headers,
    body:JSON.stringify(allowed?[{player_dbv_id:PLAYER}]:[])});
  }
  if(url.pathname==="/rest/v1/user_tournament_links"){
   if(method==="POST"){
    written=JSON.parse(request.postData()||"{}");
    publicRows.splice(0,publicRows.length,written);
    return route.fulfill({status:204,headers,body:""});
   }
   if(method==="DELETE"){
    publicRows.splice(0);
    return route.fulfill({status:204,headers,body:""});
   }
   return route.fulfill({status:200,headers,body:"[]"});
  }
  if(url.pathname==="/rest/v1/shared_tournament_hints"){
   const dbvId=(url.searchParams.get("player_dbv_id")||"").slice(3);
   return route.fulfill({status:200,headers,
    body:JSON.stringify(publicRows.filter(r=>r.player_dbv_id===dbvId).map(r=>({
     player_dbv_id:r.player_dbv_id,external_tournament_id:r.external_tournament_id,
     title:r.title,start_date:r.start_date,end_date:r.end_date,
     shared_at:r.shared_at,updated_at:new Date().toISOString()
    })))});
  }
  return route.fulfill({status:200,headers,body:"[]"});
 };
 await publisher.route("**/*",mock);
 await follower.route("**/*",mock);
 try{
  await owner.goto("/#turniere");
  await owner.locator("#add-tournament").click();
  await owner.locator("#tournament-player").selectOption(PLAYER);
  await owner.locator('#tournament-form input[name="url"]').fill(
   "https://dbv.turnier.de/tournament/"+TOURNAMENT);
  await owner.locator('#tournament-form input[name="name"]').fill("Jugendturnier Badminton");
  await owner.locator('#tournament-form input[name="startDate"]').fill("2026-12-03");
  await owner.locator("#tournament-share").check();
  await owner.locator("#tournament-save").click();
  await expect(owner.locator("#community-sync-status")).toContainText("Deine Follower können es sehen");
  expect(written.player_dbv_id).toBe(PLAYER);
  expect(written.external_tournament_id).toBe(TOURNAMENT);
  expect(written.is_shared).toBe(true);
  expect(written).not.toHaveProperty("friends");
  expect(written).not.toHaveProperty("birthYear");

  await reader.goto("/#start");
  await reader.evaluate(id=>window.badmintonSelectViewer(id),PLAYER);
  await expect(reader.locator("#shared-tournaments")).toContainText("Jugendturnier Badminton");
  await expect(reader.locator("#shared-tournaments")).toContainText("Nutzerhinweis (unbestätigt)");
  await expect(reader.locator("#shared-tournaments a")).toHaveAttribute("href",
   "https://dbv.turnier.de/tournament/"+TOURNAMENT);

  await owner.locator('[data-edit-id="'+TOURNAMENT+'"]').first().click();
  await expect(owner.locator("#tournament-share")).toBeChecked();
  await owner.locator("#tournament-share").uncheck();
  await owner.locator("#tournament-save").click();
  await expect(owner.locator("#community-sync-status")).toContainText("privat gespeichert");
  await reader.evaluate(()=>window.dispatchEvent(new Event("badminton:community-refresh")));
  await expect(reader.locator("#shared-tournaments")).not.toContainText("Jugendturnier Badminton");
  const personal=await owner.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(personal.officialLinks).toHaveLength(1);
 }finally{
  await publisher.close();
  await follower.close();
 }
});
