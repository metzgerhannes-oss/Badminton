import {test,expect} from "./supabase-isolated.fixture.mjs";

// Home-layout assertions need a synthetic member; the public Wiki itself stays anonymous.
// All requests still pass through the no-live-Supabase browser fixture.
async function prepareMockMember(page){
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"wiki-layout-mock",refresh_token:"wiki-layout-refresh",
   expires_at:Date.now()+3600000,
   user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
  }));
 });
 const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json"
 };
 await page.route("**/rest/v1/rpc/app_access_status",route=>
  route.fulfill({status:route.request().method()==="OPTIONS"?204:200,
   headers,body:route.request().method()==="OPTIONS"?"":'{"allowed":true,"owner":false}'})
 );
}

test("Wiki: three topics and anonymous mobile search",async({page})=>{
 await page.goto("/wiki.html");
 await expect(page.getByRole("heading",{name:"Schnell erklärt."})).toBeVisible();
 for(const name of ["Grundregeln","Spielsituationen","Jugend & Turniere"]){
  await expect(page.getByRole("button",{name,exact:true})).toBeVisible();
 }
 await page.getByRole("searchbox").fill("Small Games");
 await expect(page.getByRole("button",{name:/Was sind Small Games/})).toBeVisible();
 await page.getByRole("button",{name:/Was sind Small Games/}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await expect(page.getByRole("link",{name:/Offizielle Quelle/})).toHaveAttribute("href",/bwbv\.de/);
 await page.getByRole("button",{name:"Regel schließen"}).click();
 await expect(page.getByRole("dialog")).toBeHidden();
});
test("Wiki: basic rule, service fault and local search",async({page})=>{
 await page.goto("/wiki.html");
 await page.getByRole("searchbox").fill("Netzberührung");
 await expect(page.getByRole("button",{name:/Ist die Netzberührung ein Fehler/})).toBeVisible();
 await page.getByRole("searchbox").fill("Doppel");
 await expect(page.getByRole("button",{name:/Wer schlägt im Doppel nach eigenem Aufschlagpunkt auf/})).toBeVisible();
 await page.getByRole("searchbox").fill("Ranglistenpunkte");
 await expect(page.getByRole("button",{name:/Wie entstehen Ranglistenpunkte/})).toBeVisible();
});
test("Wiki: all three groups accessible on smallest phone without horizontal overflow",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/wiki.html");
 for (const group of ["Grundregeln","Spielsituationen","Jugend & Turniere"]) {
  await page.getByRole("button",{name:group,exact:true}).click();
  await expect(page.locator(".wiki-entry").first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBe(false);
 }
 await page.locator(".wiki-entry").first().click();
 await expect(page.locator("#detail-art svg")).toBeVisible();
});

test("Wiki: Small Games and score changes use specific illustrations",async({page})=>{
 await page.goto("/wiki.html");
 await page.getByRole("searchbox").fill("Box");
 await page.getByRole("button",{name:/Was bedeutet Einzel „Box“/}).click();
 await expect(page.locator("#detail-art[data-kind='smallbox'] svg")).toBeVisible();
 await page.getByRole("button",{name:"Regel schließen"}).click();
 await page.getByRole("searchbox").fill("2027");
 await page.getByRole("button",{name:/Gilt ab 2027 überall/}).click();
 await expect(page.locator("#detail-answer")).toContainText("4. Januar 2027");
});

test("Wiki: editorial release gate validates every card, source and SVG",async({page})=>{
 await page.goto("/wiki.html");
 const result=await page.evaluate(()=>{
  const topics={grundlagen:0,spielsituationen:0,jugend:0};
  const problems=[];
  for(const c of CARDS){
   topics[c.topic]=(topics[c.topic]||0)+1;
   if(!c.source?.startsWith("https://"))problems.push(c.id+": source");
   if(!c.title||!c.answer||c.answer.length>150)problems.push(c.id+": copy");
   try{const svg=art(c.kind);if(!svg.startsWith("<svg")||!svg.endsWith("</svg>"))problems.push(c.id+": SVG");}
   catch(e){problems.push(c.id+": "+String(e));}
  }
  return {length:CARDS.length,topics,problems};
 });
 expect(result).toEqual({length:61,topics:{grundlagen:22,spielsituationen:26,jugend:13},problems:[]});
});
test("Wiki: DBV/BWBV critical rule cases show correct short answers",async({page})=>{
 await page.goto("/wiki.html");
 const checks=[
  ["Deckenball","Halle","ceiling"],
  ["Spin","Ballbasis","spin"],
  ["15er","15","score15"],
  ["Jugendrangliste","fünf","ranking"]
 ];
 for(const [needle,answer,kind] of checks){
  await page.getByRole("searchbox").fill(needle);
  const entry=page.locator(".wiki-entry").first();
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.locator("#detail-answer")).toContainText(answer);
  await expect(page.locator("#detail-art")).toHaveAttribute("data-kind",kind);
  await page.getByRole("button",{name:"Regel schließen"}).click();
 }
});

test("Wiki: four separate net rules get four different illustrations",async({page})=>{
 await page.goto("/wiki.html");
 const cases=[
  ["Wie hoch ist das Netz?","netHeight"],
  ["Darf der Ball das Netz berühren?","netRoller"],
  ["Ist die Netzberührung ein Fehler?","netTouch"],
  ["Darf der Schläger übers Netz ragen?","netFollow"]
 ];
 for (const [title,kind] of cases) {
  await page.getByRole("searchbox").fill(title);
  await page.locator(".wiki-entry").first().click();
  await expect(page.locator("#detail-art")).toHaveAttribute("data-kind",kind);
  await expect(page.locator("#detail-art svg")).toBeVisible();
  await page.getByRole("button",{name:"Regel schließen"}).click();
 }
});

test("Wiki: current Home entry and offline PWA assets",async({page})=>{
 await prepareMockMember(page);
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("a.wiki-home-link")).toBeVisible();
 await expect(page.locator("a.wiki-home-link")).toHaveAttribute("href","./wiki.html");
 const response=await page.request.get("/sw.js");
 expect(response.ok()).toBe(true);
 const script=await response.text();
 for(const path of ["./wiki.html","./wiki.js","./wiki.css"]){
  expect(script).toContain('"'+path+'"');
 }
 const release=await (await page.request.get("/app-release.js")).text();
 const version=release.match(/version:"(v\d+)"/)?.[1];
 expect(version).toBeTruthy();
 expect(script).toContain("schmetterlinge-shell-"+version);
});


test("Wiki v160: the home catalogue shows all 61 cards, organized by topic, with next/previous navigation",async({page})=>{
 await page.goto("/wiki.html");
 await expect(page.locator(".wiki-entry")).toHaveCount(61);
 await expect(page.locator(".wiki-group-title")).toHaveText([
  "Grundregeln · 22 Karten","Spielsituationen · 26 Karten","Jugend & Turniere · 13 Karten"
 ]);
 await expect(page.locator("#wiki-count")).toHaveText("61 Karten");
 await page.locator(".wiki-entry").first().click();
 await expect(page.locator("#wiki-card-position")).toHaveText("1 von 61");
 await expect(page.locator("#wiki-previous")).toBeDisabled();
 await page.locator("#wiki-next").click();
 await expect(page.locator("#wiki-card-position")).toHaveText("2 von 61");
 await page.locator("#wiki-previous").click();
 await expect(page.locator("#wiki-card-position")).toHaveText("1 von 61");
 await page.locator("#detail-close").click();
 await page.getByRole("button",{name:"Spielsituationen",exact:true}).click();
 await expect(page.locator(".wiki-entry")).toHaveCount(26);
 await page.getByRole("searchbox").fill("Ablenkung");
 await expect(page.locator(".wiki-entry")).toHaveCount(1);
});

test("Wiki v160: out, distraction and doubles service boundary use truthful distinct diagrams",async({page})=>{
 await page.goto("/wiki.html");
 for(const [term,kind] of [["vollständig außerhalb","out"],["Ablenken","distract"],["hintere Linie","doublesServeBack"]]){
  await page.getByRole("searchbox").fill(term);
  await expect(page.locator(".wiki-entry").first()).toBeVisible();
  await page.locator(".wiki-entry").first().click();
  await expect(page.locator("#detail-art")).toHaveAttribute("data-kind",kind);
  await expect(page.locator("#detail-art svg")).toBeVisible();
  await page.getByRole("button",{name:"Regel schließen"}).click();
 }
});

test("Regeln & Wissen is the last Home tile and the club logo fits all viewports",async({page})=>{
 await prepareMockMember(page);
 for(const [width,logoMin] of [[320,49],[390,55],[430,61],[1440,71]]){
  await page.setViewportSize({width,height:900});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  const layout=await page.evaluate(()=>{
   const home=document.querySelector("#view-start");
   const wiki=home.querySelector(".wiki-home-link");
   const friends=home.querySelector(".dashboard-friends-section");
   const logo=document.querySelector(".topbar .brand-logo");
   const settings=document.querySelector(".topbar-settings");
   const a=wiki.getBoundingClientRect(),b=friends.getBoundingClientRect();
   const l=logo.getBoundingClientRect(),s=settings.getBoundingClientRect();
   return {
    lastElement:home.lastElementChild===wiki,
    linkBelowFriends:a.top>=b.bottom-1,
    logoWidth:l.width,
    logoClearOfSettings:l.right<=s.left+1,
    withinScreen:document.documentElement.scrollWidth<=innerWidth+2,
    desktopGridArea:getComputedStyle(wiki).gridArea,
   };
  });
  expect(layout.lastElement).toBe(true);
  expect(layout.linkBelowFriends).toBe(true);
  expect(layout.logoWidth).toBeGreaterThanOrEqual(logoMin);
  expect(layout.logoClearOfSettings).toBe(true);
  expect(layout.withinScreen).toBe(true);
  if(width>=1080)expect(layout.desktopGridArea).toBe("wiki");
  await expect(page.locator(".wiki-home-link")).toHaveAttribute("href","./wiki.html");
 }
});
