import {test,expect} from './invited-member.fixture.mjs';

const profile=i=>({id:'99-'+String(910000+i),name:'Testprofil '+i,club:'Testverein',birthYear:2014});
async function seed(page,count=2){
 await page.addInitScript(count=>{
  if(!localStorage.getItem('shuttleboard-v1'))localStorage.setItem('shuttleboard-v1',JSON.stringify({
   players:Array.from({length:count},(_,i)=>({id:'99-'+String(910000+i),name:'Testprofil '+i,club:'Testverein',birthYear:2014})),
   friends:[{id:'98-900001',name:'Alpha Test'},{id:'98-900002',name:'Beta Test'},{id:'98-900003',name:'Gamma Test'}],
   officialLinks:[],activeProfileId:'99-910000',chosen:'99-910000',historyProfilesInitialized:true
  }));
 },count);
}
async function newProfile(page){
 await page.locator('#add-player').click();
 await page.locator('#own-player-manual-fallback > summary').click();
 await page.locator('#player-form input[name=name]').fill('Neues Testprofil');
 await page.locator('#player-form input[name=id]').fill('97-900099');
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shuttleboard-v1')));
test('quota failure keeps input and old data; retry saves once without a premature follow-up event',async({page})=>{
 await seed(page);
 await page.goto('/#einstellungen/profile');
 await newProfile(page);
 await page.evaluate(()=>{
  const native=Storage.prototype.setItem;window.__blockWrite=true;window.__profileAdded=0;
  window.addEventListener('badminton:own-profile-added',()=>window.__profileAdded++);
  Storage.prototype.setItem=function(k,v){if(k==='shuttleboard-v1'&&window.__blockWrite)throw new DOMException('quota','QuotaExceededError');return native.call(this,k,v)};
 });
 await page.locator('#player-form button[type=submit]').click();
 await expect(page.locator('#player-dialog')).toBeVisible();
 await expect(page.locator('#player-dialog [data-local-save-feedback]')).toContainText('Nicht gespeichert');
 await expect(page.locator('#player-form input[name=name]')).toHaveValue('Neues Testprofil');
 expect((await stored(page)).players).toHaveLength(2);
 expect(await page.evaluate(()=>window.__profileAdded)).toBe(0);
 await page.evaluate(()=>window.__blockWrite=false);
 await page.locator('#player-form button[type=submit]').click();
 await expect(page.locator('#player-dialog')).toBeHidden();
 expect(await page.evaluate(()=>window.__profileAdded)).toBe(1);
 await page.reload();
 await expect(page.locator('#profile-list')).toContainText('Neues Testprofil');
 expect((await stored(page)).players).toHaveLength(3);
});
test('new profile at the limit stays unsaved and existing thirteen-profile stores survive reload and editing',async({page})=>{
 await seed(page,13);
 await page.goto('/#einstellungen/profile');
 await expect(page.locator('#profile-list .own-profile')).toHaveCount(13);
 await newProfile(page);
 await page.locator('#player-form button[type=submit]').click();
 await expect(page.locator('#player-dialog [data-local-save-feedback]')).toContainText('12 eigene Profile');
 expect((await stored(page)).players).toHaveLength(13);
 await page.locator('#cancel-dialog').click();
 await page.locator('[data-edit-own="99-910012"]').click();
 await page.locator('#player-form input[name=name]').fill('Erhaltenes Testprofil');
 await page.locator('#player-form button[type=submit]').click();
 await expect(page.locator('#player-dialog')).toBeHidden();
 await page.reload();
 await expect(page.locator('#profile-list')).toContainText('Erhaltenes Testprofil');
 expect((await stored(page)).players).toHaveLength(13);
});
test('full tournament list rejects another link without silently losing old entries',async({page})=>{
 await seed(page);
 await page.addInitScript(()=>{
  const data=JSON.parse(localStorage.getItem('shuttleboard-v1'));
  if(!data.officialLinks.length){data.officialLinks=Array.from({length:40},(_,i)=>({
   url:'https://dbv.turnier.de/tournament/11111111-2222-4333-8444-'+String(i).padStart(12,'0'),
   playerId:'99-910000',name:'Testturnier '+i}));localStorage.setItem('shuttleboard-v1',JSON.stringify(data));}
 });
 await page.goto('/#turniere');
 const before=(await stored(page)).officialLinks;
 await page.locator('#add-tournament').click();
 await page.locator('#tournament-form input[name=url]').fill('https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555');
 await page.locator('#tournament-save').click();
 await expect(page.locator('#tournament-dialog [data-local-save-feedback]')).toContainText('40 Einträge');
 expect((await stored(page)).officialLinks).toEqual(before);
});
test('family navigation preserves separate own and follow roles',async({page})=>{
 await seed(page);
 await page.goto('/#spieler');
 await expect(page.locator('.family-entry')).toBeVisible();
 await expect(page.locator('[data-family-profile]')).toHaveCount(2);
 await page.locator('[data-family-profile="99-910001"]').click();
 await expect(page.locator('#focused-profile')).toContainText('Testprofil 1');
 expect((await stored(page)).activeProfileId).toBe('99-910001');
 await page.goto('/#spieler');
 await page.locator('[data-view-friend="98-900001"]').click();
 expect((await stored(page)).activeProfileId).toBe('99-910001');
 await page.locator('.brand').click();
 await expect(page.locator('#focused-profile')).toContainText('Testprofil 1');
});
test('tournament save failure keeps input and never dispatches publication; local Undo never republishes',async({page})=>{
 await seed(page);await page.goto('/#turniere');
 await page.evaluate(()=>{
  window.__shares=[];window.__blockWrite=true;
  window.addEventListener('badminton:share-tournament',e=>window.__shares.push(e.detail.publicShare));
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k==='shuttleboard-v1'&&window.__blockWrite)throw new DOMException('quota','QuotaExceededError');return native.call(this,k,v)};
 });
 await page.locator('#add-tournament').click();
 const url='https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555';
 await page.locator('#tournament-form input[name=url]').fill(url);
 await page.locator('#tournament-form input[name=name]').fill('Privates Testturnier');
 await page.locator('#tournament-save').click();
 await expect(page.locator('#tournament-dialog [data-local-save-feedback]')).toContainText('Nicht gespeichert');
 await expect(page.locator('#tournament-form input[name=url]')).toHaveValue(url);
 expect((await stored(page)).officialLinks).toHaveLength(0);
 expect(await page.evaluate(()=>window.__shares)).toEqual([]);
 await page.evaluate(()=>window.__blockWrite=false);
 await page.locator('#tournament-save').click();
 await expect(page.locator('#tournament-dialog')).toBeHidden();
 const tournamentCard=page.locator('#official-tournament-list .tournament-card').first();
 await tournamentCard.locator('.saved-tournament-menu > summary').click();
 await expect(tournamentCard.locator('.saved-tournament-menu')).toHaveAttribute('open','');
 await expect(tournamentCard.locator('[data-remove-id]')).toBeVisible();
 await tournamentCard.locator('[data-remove-id]').click();
 expect((await stored(page)).officialLinks).toHaveLength(0);
 await page.locator('#toast button').click();
 expect((await stored(page)).officialLinks).toHaveLength(1);
 expect(await page.evaluate(()=>window.__shares.every(v=>v===false))).toBe(true);
 await page.reload();
 await expect(page.locator('#official-tournament-list')).toContainText('Privates Testturnier');
});
test('tap-only sorting is available without dragging and retains the own profile',async({page})=>{
 await seed(page);await page.goto('/#spieler');
 await page.locator('[data-friend-grip="98-900003"]').click();
 await expect(page.locator('#follow-order-actions')).toBeVisible();
 await page.locator('[data-follow-order="up"]').click();
 expect((await stored(page)).friends.map(x=>x.id)).toEqual(['98-900001','98-900003','98-900002']);
 await page.locator('[data-follow-order="done"]').click();
 await expect(page.locator('[data-friend-grip="98-900003"]')).toBeFocused();
 expect((await stored(page)).players).toEqual([profile(0),profile(1)]);
});
test('network error is readable; retry still denies revoked access',async({page})=>{
 await seed(page);
 let outage=true;
 await page.route('**/*.supabase.co/rest/v1/rpc/app_access_status',route=>outage?route.abort('internetdisconnected'):route.fulfill({status:200,contentType:'application/json',body:'{"allowed":false,"owner":false}'}));
 await page.goto('/');
 await expect(page.locator('#app-access-status')).toContainText('nicht erreichbar');
 await expect(page.locator('body > .app')).toBeHidden();
 outage=false;await page.locator('#app-access-retry').click();
 await expect(page.locator('#app-access-status')).toContainText('nur mit Einladung');
 await expect(page.locator('body > .app')).toBeHidden();
 expect((await stored(page)).players).toHaveLength(2);
});

const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
for(const width of [320,390,768,1280,1440,1920])test('audit profile surfaces, primary actions and touch targets at '+width+'px',async({page})=>{
 await seed(page);await page.setViewportSize({width,height:900});await page.goto('/#einstellungen/profile');
 await expect(page.locator('#profile-list .own-profile')).toHaveCount(2);
 const pairs=await page.evaluate(()=>{
  const get=s=>getComputedStyle(document.querySelector(s));
  const dark=get('.profile-active').backgroundImage.match(/rgb\([^)]+\)/g)||[get('.profile-active').backgroundColor];
  return [
   ...dark.map(bg=>[get('.profile-active h3').color,bg]),
   ...dark.map(bg=>[get('.profile-active .profile-club').color,bg]),
   [get('.player-management-head h3').color,get('.player-management').backgroundColor],
   [get('#current-account-label').color,get('.player-management').backgroundColor],
   [get('.active-profile-chip').color,get('.active-profile-chip').backgroundColor],
   [get('.profile-card:not(.profile-active) .profile-club').color,get('.profile-card:not(.profile-active)').backgroundColor]
  ];
 });
 for(const [fg,bg] of pairs)expect(ratio(fg,bg),fg+' on '+bg).toBeGreaterThanOrEqual(4.5);
 await newProfile(page);
 expect((await page.locator('#cancel-dialog').boundingBox()).width).toBeGreaterThanOrEqual(44);
 const primary=await page.locator('#player-form button[type=submit]').evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
 expect(ratio(primary.fg,primary.bg)).toBeGreaterThanOrEqual(4.5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.locator('#cancel-dialog').click();
 await page.goto('/#turniere');
 await expect(page.locator('#dbv-calendar-results .dbv-calendar-entry').first()).toBeVisible();
 const link=await page.locator('#dbv-calendar-results .dbv-calendar-entry a.card-open-primary').first().evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e.closest('.dbv-calendar-panel')).backgroundColor}));
 expect(ratio(link.fg,link.bg)).toBeGreaterThanOrEqual(4.5);
});
