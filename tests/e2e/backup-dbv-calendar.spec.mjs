import {test,expect} from "@playwright/test";

const CALENDAR="dbv-calendar-44577";
const fixture={
 players:[{id:"99-100001",name:"Testspieler A"},{id:"99-100002",name:"Testspieler B"}],
 friends:[{id:"99-100003",name:"Testfreund"}],
 officialLinks:[
  {id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",
   url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",
   name:"Testturnier",playerId:"99-100001",startDate:"2026-11-01",endDate:"2026-11-02"},
  {id:CALENDAR,source:"dbv-calendar",url:"https://turniere.badminton.de/",
   name:"DBV-Kalendertermin",playerId:"99-100002",
   startDate:"2027-03-13",endDate:"2027-07-23"}
 ],
 activeProfileId:"99-100001",chosen:"99-100001",historyProfilesInitialized:true
};
test("Offline backup from one device restores both kinds of tournaments on another",async ({browser})=>{
 const sender=await browser.newContext({baseURL:"http://127.0.0.1:4173",acceptDownloads:true,serviceWorkers:"block",viewport:{width:375,height:667}});
 const receiver=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block",viewport:{width:375,height:667}});
 try{
  const from=await sender.newPage();
  await from.addInitScript(value=>{
   localStorage.setItem("shuttleboard-v1",JSON.stringify(value));
   localStorage.setItem("schmetterlinge.calendarEvents.v1",JSON.stringify([{
    name:"Test-Spond-Termin",startDate:"2027-05-01",endDate:"2027-05-02",
    location:"Testhalle",uid:"synthetic-spond-event",source:"spond",
    playerId:"99-100001",importedAt:"2026-10-12T12:00:00Z"
   }]));
   // Mobile WebKit does not always emit a Playwright 'download' event for a
   // programmatically clicked blob: URL. Capture the real export Blob instead.
   const original=URL.createObjectURL.bind(URL);
   URL.createObjectURL=blob=>{window.__exportedBackup=blob;return original(blob)};
   // Playwright can wait indefinitely for its own navigation/download lifecycle
   // when the app activates a blob: download link. Suppress ONLY that actual
   // click in the test harness; keep the real export path and Blob intact.
   const nativeClick=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){
    if(this.href.startsWith("blob:")){
     window.__exportedFilename=this.download;
     return;
    }
    return nativeClick.call(this);
   };
  },fixture);
  await from.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await expect(from.locator("#backup-export")).toBeVisible();
  await from.locator("#backup-export").click();
  await expect(from.locator("#backup-feedback")).toContainText("Sicherung erstellt");
  const actualExport=await from.evaluate(async()=>window.__exportedBackup?.text()||"");
  expect(actualExport).toContain('"kind": "schmetterlinge-local-backup"');
  expect(await from.evaluate(()=>window.__exportedFilename)).toMatch(/^schmetterlinge-sicherung-\d{4}-\d{2}-\d{2}\.json$/);
  const bytes=Buffer.from(actualExport,"utf8");
  const archive=JSON.parse(bytes.toString("utf8"));
  expect(archive.kind).toBe("schmetterlinge-local-backup");
  expect(archive.schemaVersion).toBe(2);
  expect(archive.calendarEvents).toHaveLength(1);
  expect(archive.calendarEvents[0].source).toBe("spond");
  expect(archive.data.officialLinks).toHaveLength(2);
  expect(archive.data.officialLinks.find(x=>x.id===CALENDAR)?.source).toBe("dbv-calendar");

  const to=await receiver.newPage();
  await to.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await to.locator("#backup-file").setInputFiles({
   name:"schmetterlinge-sicherung.json",mimeType:"application/json",buffer:bytes
  });
  await expect(to.locator("#backup-restore")).toBeEnabled();
  await expect(to.locator("#backup-feedback")).toContainText("Turnierfavoriten: 2");
  to.once("dialog",dialog=>dialog.accept());
  await to.locator("#backup-restore").click();
  await expect.poll(async()=>to.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
   return s.officialLinks?.length||0;
  })).toBe(2);
  await to.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await expect(to.locator("#official-tournament-list")).toContainText("Testturnier");
  // A calendar quick-save belongs to the second own player and must not
  // appear under the first; it must still exist in the restored local state.
  const stored=await to.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}"));
  expect(stored.players).toHaveLength(2);
  const restoredCalendar=await to.evaluate(()=>JSON.parse(localStorage.getItem(
   "schmetterlinge.calendarEvents.v1")||"[]"));
  expect(restoredCalendar).toHaveLength(1);
  expect(restoredCalendar[0]).toMatchObject({
   name:"Test-Spond-Termin",source:"spond",playerId:"99-100001"
  });
  expect(stored.friends).toHaveLength(1);
  expect(stored.officialLinks.find(x=>x.id===CALENDAR)).toMatchObject({
   source:"dbv-calendar",playerId:"99-100002",
   startDate:"2027-03-13",endDate:"2027-07-23"
  });
 }finally{await sender.close();await receiver.close()}
});
