import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname),origin='https://songen.test';
const allowed=new Set(['index.html','js/messages.js','js/i18n.js','js/audio.js','js/participation.js']);
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1000,height:800},locale:'ja-JP',deviceScaleFactor:1,serviceWorkers:'block'});
 const forbidden=[],errors=[];
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  if(u.origin!==origin||!['GET','HEAD'].includes(r.method())||!allowed.has(relative)){forbidden.push({method:r.method(),origin:u.origin,path:u.pathname});return route.abort('blockedbyclient')}
  const file=path.join(root,relative);const body=fs.readFileSync(file);
  return route.fulfill({status:200,contentType:relative.endsWith('.html')?'text/html':'application/javascript',body:r.method()==='HEAD'?Buffer.alloc(0):body});
 });
 await context.routeWebSocket('**/*',ws=>{forbidden.push({webSocket:true});ws.close()});
 await context.addInitScript(()=>{
  localStorage.setItem('songen_language','ja');
  // Deterministic fresh anonymous setup; actual rules/clock/rendering are unchanged.
  let seed=31;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('#playerNameInput').fill('');
 await page.locator('#homeCpuBtn').click();
 // Choose existing emoji heads through the real settings UI, avoiding unsupported ancient-font glyphs in this CI image.
 await page.locator('#playerHeadGrid [data-value="😺"]').click();
 await page.locator('#cpuHeadGrid [data-value="🐻"]').click();
 await page.locator('#setupStartBtn').click();
 await page.waitForFunction(()=>state.running&&!state.ended&&state.player&&state.cpu);
 await page.evaluate(()=>document.fonts.ready);
 const receipt=await page.evaluate(()=>({anonymous:activePlay.name===''&&activePlay.eligible===false,mode:activePlay.mode,running:state.running,ended:state.ended,heads:[state.player.head,state.cpu.head],stage:{width:state.stageRect.width,height:state.stageRect.height},participants:[document.querySelector('#playerFighter').getBoundingClientRect().width,document.querySelector('#cpuFighter').getBoundingClientRect().width]}));
 assert.deepEqual(receipt.heads,['😺','🐻']);assert.equal(receipt.anonymous,true);assert.equal(receipt.mode,'cpu');assert.equal(receipt.running,true);assert.equal(receipt.ended,false);assert.ok(receipt.stage.width>100&&receipt.stage.height>100);assert.ok(receipt.participants.every(w=>w>0));
 const out=path.join(root,'test-results/share-capture');fs.mkdirSync(out,{recursive:true});
 await page.locator('#stage').screenshot({path:path.join(out,'songen-real-battle.png')});
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'capture-receipt.json'),JSON.stringify({...receipt,source:'actual DOM stage after anonymous normal start',seed:31,forbiddenRequests:0,pageErrors:0},null,2)+'\n');
 await context.close();
} finally {await browser.close()}
