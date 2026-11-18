'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
 const root=path.join(__dirname,'..');
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}
  const resolved=fs.statSync(file,{throwIfNoEntry:false})?.isDirectory()?path.join(file,'index.html'):file;
  if(!fs.existsSync(resolved)){res.writeHead(404);res.end('Not found');return}
  res.setHeader('Content-Type',mime[path.extname(resolved)]||'application/octet-stream');
  res.end(fs.readFileSync(resolved));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>fs.existsSync(p));
 assert.ok(binary,'Chromium is installed');
 const browser=await chromium.launch({headless:true,executablePath:binary,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({
   viewport:{width:393,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   locale:'el-GR',timezoneId:'Europe/Athens',serviceWorkers:'allow'
  });
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#board button.sudoku-cell').count(),81);
  assert.equal(await page.locator('#saveNote').isVisible(),false,'Autosave text stays hidden on successful save');
  const fitsScreen=await page.evaluate(()=>({
    doc:document.documentElement.scrollHeight,
    view:document.documentElement.clientHeight,
    body:document.body.scrollHeight
  }));
  assert.ok(fitsScreen.doc<=fitsScreen.view+2,
    'Sudoku must fit 393×844 without page scrolling: '+JSON.stringify(fitsScreen));
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Reload starts paused');
  // Finish all nine correct copies of a digit. The pad key disappears, but the
  // remaining keys retain their positions. Undo restores the key immediately.
  const missingOnes=await page.evaluate(()=>{
    const game=JSON.parse(localStorage.getItem('sudokufunny.game.v1'));
    return game.solution.flatMap((v,i)=>v===1&&!game.puzzle[i]?[i]:[]);
  });
  assert.ok(missingOnes.length>0,'A digit has blank cells to fill');
  const otherKey=await page.locator('#numberPad [data-number="2"]').boundingBox();
  await page.locator('#pauseButton').click();
  for(const index of missingOnes.slice(0,-1)){
    await page.locator('#board button').nth(index).click();
    await page.locator('#numberPad [data-number="1"]').click();
  }
  assert.equal(await page.locator('#numberPad [data-number="1"]').isVisible(),true,
    'Digit stays visible before its ninth correct occurrence');
  await page.locator('#board button').nth(missingOnes.at(-1)).click();
  await page.locator('#numberPad [data-number="1"]').click();
  const completedInfo=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('sudokufunny.game.v1'));
    const count=data.values.filter((v,i)=>v===1&&v===data.solution[i]).length;
    const btn=document.querySelector('#numberPad [data-number="1"]');
    return {count,disabled:btn.disabled,css:getComputedStyle(btn).visibility,
      className:btn.className};
  });
  assert.equal(completedInfo.count,9,'All nine ones are correctly placed');
  assert.equal(await page.locator('#numberPad [data-number="1"]').isVisible(),false,
    'Completed digit disappears: '+JSON.stringify(completedInfo));
  assert.equal(await page.locator('#numberPad [data-number="1"]').isDisabled(),true,
    'Completed digit cannot be selected');
  const otherKeyAfter=await page.locator('#numberPad [data-number="2"]').boundingBox();
  assert.equal(otherKeyAfter.x,otherKey.x,'Remaining keypad digits do not shift');
  await page.locator('#undoButton').click();
  assert.equal(await page.locator('#numberPad [data-number="1"]').isVisible(),true,
    'Undo makes the digit reappear');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#numberPad [data-number="1"]').isVisible(),true,
    'Remaining digits are recalculated after reopening the game');
  assert.equal(await page.locator('input[name=difficulty]').count(),4);
  assert.equal(await page.locator('.status-strip').locator(':scope > *').count(),4,
    'Time, progress, pause and settings share one compact toolbar');
  assert.equal(await page.locator('.game-heading').count(),0,'Redundant heading is removed');
  const hero=await page.locator('.sudoku-hero-art').boundingBox();
  assert.ok(hero&&hero.height>=74&&hero.height<=115,'Hero fits Applications 3:1 banner band');
  assert.ok(hero&&hero.width>=350&&hero.width<=370,'Hero aligns with other app headers');
  const boardBounds=await page.locator('.board-wrap').boundingBox();
  assert.ok(boardBounds&&boardBounds.width>=hero.width+8,'Board gains horizontal space compared with banner');
  assert.ok(boardBounds.y-hero.y-hero.height<80,'No redundant heading between banner and board');
  assert.ok(boardBounds.x>1&&boardBounds.x+boardBounds.width<394,'Enlarged board stays within mobile viewport');
  await page.locator('#pauseButton').click();
  assert.equal(await page.locator('#pauseOverlay').isVisible(),false,'Toolbar can resume the game');
  await page.locator('#pauseButton').click();
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Toolbar pauses the game');
  await page.locator('#resumeButton').click();
  assert.equal(await page.locator('#pauseOverlay').isVisible(),false);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  const firstEmpty=before.puzzle.findIndex(v=>v===0);
  assert.ok(firstEmpty>=0);
  await page.locator('#board button').nth(firstEmpty).click();
  await page.locator('#numberPad button[data-number="5"]').click();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  assert.equal(saved.values[firstEmpty],5,'Move stored immediately');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Reload pauses even if saved while running');
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  assert.equal(saved.values[firstEmpty],5,'Saved move survives reload');
  await page.locator('#resumeButton').click();
  await page.waitForTimeout(1200);
  await page.evaluate(()=>window.postMessage({type:'sudokufunny:visibility',active:false},location.origin));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1'))?.paused===true);
  const paused=await page.locator('#timer').textContent();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#timer').textContent(),paused,'Timer freezes after switching Applications tab');
  await page.evaluate(()=>window.postMessage({type:'sudokufunny:visibility',active:true},location.origin));
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Switching back does not resume without consent');
  await page.locator('#settingsButton').click();
  await page.locator('input[name="difficulty"][value="hard"]').check();
  await page.locator('.save-settings').click();
  const unchanged=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  assert.equal(unchanged.level,before.level,'Difficulty setting cannot overwrite current puzzle');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#newButton').click();
  const next=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  assert.equal(next.level,'hard','New game uses chosen difficulty');
  assert.equal(next.paused,true,'New game awaits manual resume');
  await page.reload({waitUntil:'domcontentloaded'});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('sudokufunny.game.v1')));
  assert.deepEqual(after.puzzle,next.puzzle,'New puzzle survives reload unchanged');
  console.log('PASS Sudoku mobile Chromium: 81 cells, aligned banner, saved moves, timer pause on app switch, difficulty settings, new puzzle persistence');
  await context.close();
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error('FAIL Sudoku browser:',error);process.exitCode=1;});
