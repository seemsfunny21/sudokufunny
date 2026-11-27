'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const p=path.resolve(root,'.'+name);
  if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const file=fs.statSync(p,{throwIfNoEntry:false})?.isDirectory()?path.join(p,'index.html'):p;
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert.ok(executablePath,'Chromium required');
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:844},isMobile:true,hasTouch:true,locale:'el-GR',serviceWorkers:'allow'});
  const base='http://127.0.0.1:'+server.address().port+'/';
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.stats.v1')||'null'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#settingsButton').click();
  assert.equal(await page.locator('#statsWins').textContent(),'0');
  assert.equal(await page.locator('#statsLosses').textContent(),'0');
  await page.locator('#closeSettings').click();
  await page.locator('#resumeButton').click();
  await page.locator('#pauseButton').click();
  assert.equal(await read(),null,'Pausing never records a result');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await read(),null,'Reloading never records a result');
  await page.locator('#resumeButton').click();
  const empty=await page.evaluate(()=>{
   const g=JSON.parse(localStorage.getItem('sudokufunny.game.v1'));
   return g.puzzle.findIndex(v=>v===0);
  });
  await page.locator('#board button').nth(empty).click();
  await page.locator('#numberPad [data-number="3"]').click();
  await page.locator('#newButton').click();
  await page.locator('#gameDialogCover').getByRole('button',{name:'Συνέχεια',exact:true}).click();
  await page.locator('#gameDialogCover').waitFor({state:'hidden'});
  let stats=await read();
  assert.equal(stats.wins,0);
  assert.equal(stats.losses,1,'Confirmed replacement of a started puzzle counts an abandonment');
  assert.equal(stats.byLevel.medium.losses,1);
  await page.reload({waitUntil:'domcontentloaded'});
  stats=await read();
  assert.equal(stats.losses,1,'Reload cannot duplicate the abandonment');
  await page.locator('#newButton').click();
  await page.locator('#gameDialogCover').getByRole('button',{name:'Συνέχεια',exact:true}).click();
  await page.locator('#gameDialogCover').waitFor({state:'hidden'});
  stats=await read();
  assert.equal(stats.losses,1,'Replacing untouched puzzle does not count a loss');

  // Seed an almost-complete valid puzzle just before load (after the previous
  // pagehide autosave) and finish its last digit by a real user click.
  await page.addInitScript(()=>{
   if(localStorage.getItem('__stats_sudoku_seeded')==='1')return;
   const key='sudokufunny.game.v1',g=JSON.parse(localStorage.getItem(key)||'null');
   if(!g)return;
   const index=g.puzzle.findIndex(v=>v===0);
   if(index<0)return;
   g.values=g.solution.slice();g.values[index]=0;
   g.notes=Array(81).fill(0);g.history=[];g.completed=false;g.paused=true;
   localStorage.setItem(key,JSON.stringify(g));
   localStorage.setItem('__stats_sudoku_index',String(index));
   localStorage.setItem('__stats_sudoku_seeded','1');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const last=await page.evaluate(()=>{
   const i=Number(localStorage.getItem('__stats_sudoku_index'));
   const g=JSON.parse(localStorage.getItem('sudokufunny.game.v1'));
   return {index:i,digit:g.solution[i]};
  });
  assert.ok(last.digit>=1&&last.digit<=9);
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(last.index).click();
  await page.locator('#numberPad [data-number="'+last.digit+'"]').click();
  stats=await read();
  assert.equal(stats.wins,1,'Completing the puzzle records exactly one win');
  assert.equal(stats.losses,1);
  assert.equal(stats.byLevel.medium.wins,1,'Solved puzzle grouped by actual difficulty');
  await page.reload({waitUntil:'domcontentloaded'});
  stats=await read();
  assert.equal(stats.wins,1,'Completed puzzle reload never double-counts');
  await page.locator('#settingsButton').click();
  assert.equal(await page.locator('#statsWins').textContent(),'1');
  assert.equal(await page.locator('#statsLosses').textContent(),'1');
  assert.match(await page.locator('#statsDetail').textContent(),/Μέτριο 1\/1/);
  console.log('PASS Sudoku statistics: pause/reload ignored, confirmed abandonment counted once, completion counted once, settings and persistence');
  await page.context().close();
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error('FAIL Sudoku statistics:',e.stack||e);process.exitCode=1});
