import {test,expect} from "./invited-member.fixture.mjs";

test("v246: followed Léona shows the source-backed Augsburg tournament today without a manual profile URL",async({page})=>{
 // Keep the source-backed November event test repeatable after the tournament.
 await page.clock.setFixedTime(new Date("2026-11-07T08:00:00+01:00"));
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Eigenes Testprofil"}],
   friends:[{id:"05-067866",name:"Léona Plaisant",club:"SpVgg. Mössingen"}],
   activeProfileId:"05-070879",chosen:"05-070879",
   officialLinks:[],historyProfilesInitialized:true
  }));
 });
 await page.goto("/#start");
 await page.evaluate(()=>window.badmintonSelectViewer("05-067866"));
 const detail=page.locator("#dashboard-next");
 await expect(detail).toContainText("Südostdeutsche Meisterschaften U13");
 await expect(detail).toContainText("Teilnahme vom Verein angekündigt");
 await expect(detail).not.toContainText("Bitte in den Freundeseinstellungen");
 await expect(detail.locator('a[href="https://dbv.turnier.de/tournament/FCBE16EF-D5A9-493A-9935-B6FF78669F6C"]')).toBeVisible();
 await expect(detail.locator('a[href*="spvgg.org/abteilungen/badminton/aktuelles/"]')).toBeVisible();
});
