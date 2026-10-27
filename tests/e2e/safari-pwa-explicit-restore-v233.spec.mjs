import {readFile} from "node:fs/promises";
import {test,expect} from "./supabase-isolated.fixture.mjs";

// Two truly independent browser storage contexts. Synthetic identities only.
// All requests except loopback are aborted or answered by local fixtures.
const BASE="http://127.0.0.1:4173";
const PLAYER="99-100001",FRIEND="99-100002";
const TOURNAMENT="11111111-1111-4111-8111-111111111111";
const FAMILY={
 players:[{id:PLAYER,name:"Testperson A",club:"Testverein"}],
 friends:[{id:FRIEND,name:"Testperson B"}],
 officialLinks:[{
  id:TOURNAMENT,url:"https://dbv.turnier.de/tournament/"+TOURNAMENT,
  name:"Fiktives Testturnier",playerId:PLAYER,startDate:"2026-11-21",
  endDate:"2026-11-22",place:"Testhalle"
 }],
 activeProfileId:PLAYER,chosen:PLAYER,historyProfilesInitialized:true
};
const CALENDAR=[{
 name:"Privater Testtermin",startDate:"2026-11-20",endDate:"2026-11-20",
 location:"Testhalle",uid:"synthetic-private-calendar",source:"spond",
 playerId:PLAYER,importedAt:"2026-10-27T09:00:00.000Z"
}];
const SESSION={
 access_token:"synthetic-member-access",refresh_token:"synthetic-member-refresh",
 expires_at:4102444800000,user_id:"00000000-0000-4000-8000-000000000099"
};
async function denyExternal(context){
 await context.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.origin===BASE)return route.continue();
  return route.abort("blockedbyclient");
 });
}
async function mockMembership(context){
 await context.route("**/*.supabase.co/**",route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const headers={
   "Access-Control-Allow-Origin":"*",
   "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer,x-client-info",
   "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
   "Content-Type":"application/json"
  };
  if(request.method()==="OPTIONS")
   return route.fulfill({status:204,headers,body:""});
  if(path==="/rest/v1/rpc/app_access_status")
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  return route.fulfill({status:401,headers,body:'{"message":"Synthetic QA: blocked"}'});
 });
}
test("Safari backup is explicitly restored in a separate installed PWA storage context",async({browser},info)=>{
 test.setTimeout(90000);
 // Context routing is fail-closed for every non-loopback request.
 // Do not attach a per-context dead proxy: WebKit and Chromium can stall
 // while loading even local pages through that proxy.
 const options={baseURL:BASE,serviceWorkers:"block"};
 const safari=await browser.newContext({...options,acceptDownloads:true});
 const installed=await browser.newContext(options);
 try{
  await denyExternal(safari);
  await denyExternal(installed);
  await mockMembership(installed);
  await safari.addInitScript(({family,calendar})=>{
   if(!localStorage.getItem("shuttleboard-v1"))
    localStorage.setItem("shuttleboard-v1",JSON.stringify(family));
   if(!localStorage.getItem("schmetterlinge.calendarEvents.v1"))
    localStorage.setItem("schmetterlinge.calendarEvents.v1",JSON.stringify(calendar));
  },{family:FAMILY,calendar:CALENDAR});
  await installed.addInitScript(session=>{
   if(!localStorage.getItem("schmetterlinge.communitySession.v1"))
    localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify(session));
  },SESSION);
  const from=await safari.newPage(),to=await installed.newPage();
  await from.goto("/welcome.html#installation",{waitUntil:"domcontentloaded"});
  await expect(from.locator("#install-existing-backup")).toBeVisible();
  await expect(from.locator("#install-hint")).toContainText("Einstellungen");
  const [download]=await Promise.all([
   from.waitForEvent("download"),from.locator("#install-backup-export").click()
  ]);
  const file=info.outputPath("synthetic-safari-backup.json");
  await download.saveAs(file);
  const bytes=await readFile(file);
  const archive=JSON.parse(bytes.toString("utf8"));
  expect(archive.schemaVersion).toBe(2);
  expect(archive.data.players.map(p=>p.id)).toEqual([PLAYER]);
  expect(archive.data.friends.map(p=>p.id)).toEqual([FRIEND]);
  expect(archive.data.officialLinks).toHaveLength(1);
  expect(archive.calendarEvents).toHaveLength(1);
  expect(JSON.stringify(archive)).not.toContain(SESSION.access_token);
  const original=await from.evaluate(()=>({
   family:localStorage.getItem("shuttleboard-v1"),
   calendar:localStorage.getItem("schmetterlinge.calendarEvents.v1")
  }));

  // Exercise the real first-run restore entry: a new PWA must import before
  // setting up its first profile, without bypassing membership permissions.
  await to.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(to.locator("#first-run-dialog")).toBeVisible({timeout:20000});
  await to.locator("#first-run-restore").click();
  await expect(to).toHaveURL(/#einstellungen\/daten$/);
  await expect(to.locator("#first-run-dialog")).not.toBeVisible();
  await expect(to.locator("#settings-room-daten")).toBeVisible({timeout:20000});
  const before=await to.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
  expect(String(before)).not.toContain(PLAYER);
  await to.locator("#backup-file").setInputFiles({
   name:"synthetic-safari-backup.json",mimeType:"application/json",buffer:bytes
  });
  await expect(to.locator("#backup-feedback")).toContainText("Private Kalendertermine: 1");
  to.once("dialog",dialog=>dialog.dismiss());
  await to.locator("#backup-restore").click();
  await expect(to.locator("#backup-feedback")).toContainText("abgebrochen");
  expect(String(await to.evaluate(()=>localStorage.getItem("shuttleboard-v1"))))
   .not.toContain(PLAYER);
  to.once("dialog",dialog=>dialog.accept());
  const loaded=to.waitForEvent("load");
  await to.locator("#backup-restore").click();
  await loaded;
  await expect.poll(()=>to.evaluate(()=>
   JSON.parse(localStorage.getItem("shuttleboard-v1")||"null")?.activeProfileId
  )).toBe(PLAYER);
  await to.reload({waitUntil:"domcontentloaded"});
  await expect(to.locator(".focused-profile")).toContainText("Testperson A");
  const restored=await to.evaluate(()=>({
   family:JSON.parse(localStorage.getItem("shuttleboard-v1")||"null"),
   calendar:JSON.parse(localStorage.getItem("schmetterlinge.calendarEvents.v1")||"null")
  }));
  expect(restored.family.friends.map(p=>p.id)).toEqual([FRIEND]);
  expect(restored.family.officialLinks).toHaveLength(1);
  expect(restored.family.officialLinks[0].id).toBe(TOURNAMENT.toUpperCase());
  expect(restored.calendar).toHaveLength(1);
  expect(restored.calendar[0].name).toBe("Privater Testtermin");
  expect(restored.calendar[0].playerId).toBe(PLAYER);
  expect(await from.evaluate(()=>({
   family:localStorage.getItem("shuttleboard-v1"),
   calendar:localStorage.getItem("schmetterlinge.calendarEvents.v1")
  }))).toEqual(original);
 }finally{
  await safari.close();
  await installed.close();
 }
});
