import {test,expect} from "@playwright/test";
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
 expect(result).toEqual({length:53,topics:{grundlagen:19,spielsituationen:21,jugend:13},problems:[]});
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

test("Wiki v155: up-to-date Home entry and offline PWA assets",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("a.wiki-home-link")).toHaveAttribute("href","./wiki.html");
 const response=await page.request.get("/sw.js");
 expect(response.ok()).toBe(true);
 const script=await response.text();
 for(const path of ["./wiki.html","./wiki.js","./wiki.css"]){
  expect(script).toContain('"'+path+'"');
 }
 expect(script).toContain("schmetterlinge-shell-v155");
});
