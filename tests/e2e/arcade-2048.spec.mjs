import {test,expect} from './invited-member.fixture.mjs';
const own=[{id:'99-000001',name:'Eigenes A'},{id:'99-000002',name:'Eigenes B'}];
test.beforeEach(async({page})=>{
 await page.addInitScript(own=>{
  if(!localStorage.getItem('shuttleboard-v1'))
   localStorage.setItem('shuttleboard-v1',JSON.stringify({players:own,friends:[{id:'98-000003',name:'Gefolgt'}],
    officialLinks:[],activeProfileId:own[0].id,chosen:own[0].id,historyProfilesInitialized:true}));
 },own);
});
test('F10 P2-C: 2048 at 320px is private, keyboard/touch ready and pauses without elapsed time',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto('/#spiele');
 await page.locator('#arcade-game').selectOption('2048');
 await expect(page.locator('#arcade-2048-shell')).toBeVisible();
 await expect(page.locator('#arcade-snake-shell')).toBeHidden();
 await expect(page.locator('#arcade-2048-profile option')).toHaveCount(2);
 await expect(page.locator('#arcade-2048-profile')).not.toContainText('Gefolgt');
 await expect(page.locator('#arcade-2048-board [role=gridcell]')).toHaveCount(16);
 await expect(page.locator('#arcade-2048-time')).toHaveText('180 s');
 const controls=page.locator('[data-2048-direction]');
 for(const b of await controls.all()){
  const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.locator('#arcade-2048-start').click();
 await expect(page.locator('#arcade-2048-status')).toContainText('Start in');
 await expect(page.locator('#arcade-game')).toBeDisabled();
 await page.locator('#arcade-2048-pause').click();
 await expect(page.locator('#arcade-2048-status')).toContainText('Pausiert');
 const paused=await page.locator('#arcade-2048-time').textContent();
 await page.waitForTimeout(400);
 expect(await page.locator('#arcade-2048-time').textContent()).toBe(paused);
 await page.locator('#arcade-2048-exit').click();
 await expect(page.locator('#view-turniere')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('schmetterlinge-arcade-2048-v1'))).toBeNull();
});
test('F10 P2-C: 2048 local own-profile records do not mix with Snake or family storage',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('schmetterlinge-arcade-2048-v1',JSON.stringify({version:1,records:[
   {profileId:'99-000001',arcadeId:'11111111-1111-4111-8111-111111111111',best:2048,modeVersion:1},
   {profileId:'99-000002',arcadeId:'22222222-2222-4222-8222-222222222222',best:32,modeVersion:1}]}));
 });
 await page.goto('/#spiele');
 await page.locator('#arcade-game').selectOption('2048');
 await expect(page.locator('#arcade-2048-best')).toHaveText('2048');
 await page.locator('#arcade-2048-profile').selectOption('99-000002');
 await expect(page.locator('#arcade-2048-best')).toHaveText('32');
 await page.locator('#arcade-game').selectOption('snake');
 await expect(page.locator('#arcade-snake-shell')).toBeVisible();
 await expect(page.locator('#arcade-best')).toHaveText('0');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shuttleboard-v1')).players)).toEqual(own);
});
