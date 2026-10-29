import {test,expect} from "./supabase-isolated.fixture.mjs";
import {readFile} from "node:fs/promises";

const FAMILY="shuttleboard-v1",CALENDAR="schmetterlinge.calendarEvents.v1";
const PLAYER="05-123456",OTHER="05-654321";
const makeFamily=(id,name)=>({
 players:[{id,name,club:"Beispielverein"}],friends:[],officialLinks:[],
 activeProfileId:id,chosen:id,historyProfilesInitialized:true
});
const makeEvent=(playerId,name,uid)=>({
 id:"ignored-and-regenerated",name,startDate:"2026-11-21",endDate:"2026-11-22",
 location:"Testhalle",uid,source:"spond",playerId,importedAt:"2026-10-12T16:00:00.000Z"
});
async function setup(context,family,events){
 await context.addInitScript(({family,events})=>{
  if(localStorage.getItem("shuttleboard-v1")===null)
   localStorage.setItem("shuttleboard-v1",JSON.stringify(family));
  if(localStorage.getItem("schmetterlinge.calendarEvents.v1")===null)
   localStorage.setItem("schmetterlinge.calendarEvents.v1",JSON.stringify(events));
  if(!localStorage.getItem("schmetterlinge.communitySession.v1"))localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({access_token:"backup-test-member",refresh_token:"backup-test-refresh",expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"}));
   if(localStorage.getItem("keep-other-settings")===null)
   localStorage.setItem("keep-other-settings","yes");
 },{family,events});
 await context.route("**/*.supabase.co/**",route=>route.fulfill({
  status:200,contentType:"application/json",
  headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"},body:new URL(route.request().url()).pathname.endsWith("/rpc/app_access_status")?'{"allowed":true,"owner":false}':"[]"
 }));
}
async function stored(page){
 return page.evaluate(({family,calendar})=>({
  family:JSON.parse(localStorage.getItem(family)||"null"),
  events:JSON.parse(localStorage.getItem(calendar)||"null"),
  unrelated:localStorage.getItem("keep-other-settings")
 }),{family:FAMILY,calendar:CALENDAR});
}
test("private Spond appointments travel with the offline backup, restore needs confirmation",async ({browser},info)=>{
 test.setTimeout(70_000);
 const original=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block",acceptDownloads:true});
 const target=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 try{
  await setup(original,makeFamily(PLAYER,"Beispiel Spieler"),[makeEvent(PLAYER,"Spond Jugendturnier","test-private-event")]);
  await setup(target,makeFamily(OTHER,"Altes Gerät"),[makeEvent(OTHER,"Bestehender Kalendereintrag","old-event")]);
  const from=await original.newPage(),to=await target.newPage();
  await from.goto("/#einstellungen/daten",{waitUntil:"domcontentloaded"});
   await expect(from.locator("#settings-room-daten")).toBeVisible();
  const save=from.waitForEvent("download");
  await from.locator("#backup-export").click();
  const download=await save;
  expect(download.suggestedFilename()).toMatch(/^schmetterlinge-sicherung-.*\.json$/);
  const path=info.outputPath("synthetic-offline-backup.json");
  await download.saveAs(path);
  const bytes=await readFile(path);
  const archive=JSON.parse(bytes.toString("utf8"));
  expect(archive.schemaVersion).toBe(2);
  expect(archive.calendarEvents).toHaveLength(1);
  expect(archive.calendarEvents[0]).toMatchObject({name:"Spond Jugendturnier",playerId:PLAYER});
  expect(archive).not.toHaveProperty("access_token");
  await to.goto("/#einstellungen/daten",{waitUntil:"load"});
   await expect(to.locator("#settings-room-daten")).toBeVisible();
  await to.locator("#backup-file").setInputFiles({name:"test-backup.json",mimeType:"application/json",buffer:bytes});
  await expect(to.locator("#backup-feedback")).toContainText("Private Kalendertermine: 1");
  let prompt="";
  to.once("dialog",async dialog=>{prompt=dialog.message();await dialog.dismiss()});
  await to.locator("#backup-restore").click();
  await expect(to.locator("#backup-feedback")).toContainText("abgebrochen");
  expect(prompt).toContain("privaten Kalendertermine");
  expect((await stored(to)).family.players[0].id).toBe(OTHER);
  to.once("dialog",dialog=>dialog.accept());
  const restoredLoad=to.waitForEvent("load");
  await to.locator("#backup-restore").click();
  await restoredLoad;
  await expect.poll(async()=>{const s=await stored(to);return s.family?.players?.[0]?.id}).toBe(PLAYER);
  const restored=await stored(to);
  expect(restored.events).toHaveLength(1);
  expect(restored.events[0].name).toBe("Spond Jugendturnier");
  expect(restored.events[0].playerId).toBe(PLAYER);
  expect(restored.events[0].id).toMatch(/^calendar-[0-9a-f]{8}$/);
  expect(restored.unrelated).toBe("yes");
  await to.reload({waitUntil:"domcontentloaded"});
  await expect(to.locator(".focused-profile")).toContainText("Beispiel Spieler");
  const after=await stored(to);
  expect(after.events[0].name).toBe("Spond Jugendturnier");
 }finally{await original.close();await target.close()}
});
test("legacy backups preserve the target's newer private calendar and invalid files cannot restore",async ({page})=>{
 const family=makeFamily(OTHER,"Vorhandenes Profil");
 const retained=[makeEvent(OTHER,"Privater Termin","stay")];
 await setup(page.context(),family,retained); // Synthetic member session / RPC fixture required for invitation-only app.\n
 await page.goto("/#einstellungen/daten",{waitUntil:"load"});
  await expect(page.locator("#settings-room-daten")).toBeVisible();
 const legacy={kind:"schmetterlinge-local-backup",schemaVersion:1,
  createdAt:"2026-10-10T12:00:00.000Z",data:makeFamily(PLAYER,"Importiertes Profil")};
 await page.locator("#backup-file").setInputFiles({name:"older-backup.json",mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify(legacy))});
 await expect(page.locator("#backup-feedback")).toContainText("Ältere Sicherung");
 page.once("dialog",dialog=>dialog.accept());
 const restoredLoad=page.waitForEvent("load");
 await page.locator("#backup-restore").click();
 await restoredLoad;
 await expect.poll(async()=>((await stored(page)).family?.players?.[0]?.id)).toBe(PLAYER);
 expect((await stored(page)).events[0].name).toBe("Privater Termin");
 await page.locator("#backup-file").setInputFiles({name:"broken.json",mimeType:"application/json",
  buffer:Buffer.from('{"schemaVersion":2,"calendarEvents":"invalid"}')});
 await expect(page.locator("#backup-restore")).toBeDisabled();
 expect((await stored(page)).family.players[0].id).toBe(PLAYER);
});


test("P1: restored follower-only backup preserves Follow without inventing own-player rights",async({page})=>{
 const follower={id:"99-100005",name:"Testperson Follow",club:"Musterverein"};
 await setup(page.context(),makeFamily(OTHER,"Vorheriges Eigenprofil"),[]);
 await page.goto("/#einstellungen/daten",{waitUntil:"load"});
 await expect(page.locator("#settings-room-daten")).toBeVisible();
 const archive={kind:"schmetterlinge-local-backup",schemaVersion:2,
  createdAt:"2026-10-29T12:00:00.000Z",
  data:{players:[],friends:[follower],officialLinks:[],activeProfileId:"",chosen:follower.id},
  calendarEvents:[]};
 await page.locator("#backup-file").setInputFiles({name:"follower-only.json",
  mimeType:"application/json",buffer:Buffer.from(JSON.stringify(archive))});
 await expect(page.locator("#backup-feedback")).toContainText("Eigene Profile: 0");
 await expect(page.locator("#backup-feedback")).toContainText("Gefolgte Spieler: 1");
 await expect(page.locator("#backup-feedback")).toContainText("Kein eigenes Profil");
 page.once("dialog",dialog=>dialog.accept());
 const loaded=page.waitForEvent("load");
 await page.locator("#backup-restore").click();
 await loaded;
 const data=(await stored(page)).family;
 expect(data.players).toEqual([]);
 expect(data.friends.map(x=>x.id)).toEqual([follower.id]);
 expect(data.activeProfileId).toBe("");
 expect(data.chosen).toBe("");
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#friend-list [data-follow-row='"+follower.id+"']")).toBeVisible();
 await expect(page.locator("#profile-list .own-profile")).toHaveCount(0);
 await page.reload({waitUntil:"domcontentloaded"});
 const after=(await stored(page)).family;
 expect(after.players).toEqual([]);
 expect(after.friends[0].id).toBe(follower.id);
 expect(after.activeProfileId).toBe("");
});
