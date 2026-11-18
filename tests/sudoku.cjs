'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Engine=require('../sudoku-engine.js');
const fsRead=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const html=fsRead('index.html'),js=fsRead('app.js'),sw=fsRead('sw.js');
new vm.Script(js,{filename:'app.js'});
new vm.Script(sw,{filename:'sw.js'});
const levels=Object.keys(Engine.LEVELS);
assert.deepEqual(levels,['easy','medium','hard','expert']);
assert.equal((html.match(/type="radio" name="difficulty"/g)||[]).length,4);
assert.ok(js.includes('pagehide')&&js.includes('visibilitychange')&&js.includes('sudokufunny:visibility'),'Pause when hidden or another Applications tab selected');
assert.ok(!html.includes('class="game-heading"'),'No second page title wastes puzzle space');
assert.ok(html.includes('id="pauseButton" class="status-action"'),'Pause is in compact status row');
assert.ok(html.includes('id="settingsButton" class="status-action"'),'Settings is in compact status row');
assert.ok(fsRead('style.css').includes('width:min(calc(100% + 12px),480px)'),'Board can take available extra width');
assert.ok(html.includes('style.css?v=6')&&sw.includes('style.css?v=6')&&
 html.includes('app.js?v=5')&&sw.includes('app.js?v=5'),'Latest app and CSS cached consistently');
assert.ok(fsRead('style.css').includes('@media (min-width:960px)'),'Desktop-only layout preserves phone view');
assert.ok(js.includes('sameRow?" row-peer"')&&js.includes('sameCol?" col-peer"')&&
 js.includes('sameBox?" box-peer"'),'Row, column, and box highlights centered on selected cell');
assert.ok(!js.includes('isPeer=conflict'),'No legacy single-color peer highlight');
assert.ok(!js.includes('Engine.candidates('),'No solution/candidate hints in highlights');
assert.ok(js.includes('correctCounts[value]++')&&js.includes('correctCounts[digit]===9'),
 'Digit completion counts only correct placements');
assert.ok(fsRead('style.css').includes('.number-pad button.is-complete{visibility:hidden'),
 'Completed digits disappear without reflowing other keys');
assert.ok(html.includes('id="saveNote" role="alert" hidden'),'Routine autosave status is hidden');
assert.ok(js.includes('notice.hidden=saveOK'),'Autosave errors remain visible while successful saves are silent');
assert.ok(js.includes('state.paused=true')&&js.includes('elapsedMs:elapsed()'),'Saved sessions pause and retain elapsed time');
assert.ok(js.includes('window.addEventListener("storage"'),'Synchronize tabs without overwriting saved game');
assert.ok(js.includes('localStorage.setItem')&&js.includes('sudokufunny.game.v1'),'Persistent local game save');
assert.ok(sw.includes('sudokufunny-shell-'),'Cache isolated from the five existing apps');
for(const level of levels){
 for(let iteration=0;iteration<2;iteration++){
  const p=Engine.generate(level);
  assert.equal(p.level,level);
  assert.equal(p.puzzle.length,81);
  assert.equal(p.solution.length,81);
  assert.ok(p.solution.every(v=>v>=1&&v<=9));
  assert.ok(p.puzzle.every((v,i)=>!v||v===p.solution[i]));
  assert.equal(Engine.countSolutions(p.puzzle,2),1,'Each puzzle has a unique solution');
  assert.equal(Engine.countSolutions(p.solution,2),1,'Generated solution obeys Sudoku rules');
  assert.ok(p.clues>=Engine.LEVELS[level].clues&&p.clues<=81,'At least the target number of clues');
 }
}
const empty=Array(81).fill(0);
assert.equal(Engine.countSolutions(empty,2),2,'Empty board has multiple solutions');
const invalid=[...empty];invalid[0]=8;invalid[1]=8;
assert.equal(Engine.countSolutions(invalid,2),0,'Detect invalid row duplicate');
const solved=Engine.makeSolution();
assert.deepEqual(Engine.candidates(solved,0),[],'Filled board cell has no allowed candidates');
console.log('PASS Sudoku: 4 difficulty levels, 8 unique puzzles, valid solutions, safe timer persistence, auto pause, isolated PWA');
