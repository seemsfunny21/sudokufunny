(()=>{
 "use strict";
 const Engine=window.SudokuFunnyEngine;
 if(!Engine)throw Error("Sudoku engine missing");
 const GAME_KEY="sudokufunny.game.v1";
 const SETTINGS_KEY="sudokufunny.settings.v1";
 const STATS_KEY="sudokufunny.stats.v1";
 const $=id=>document.getElementById(id);
 const LEVELS=Engine.LEVELS;
 const DEFAULT={difficulty:"medium",showErrors:true};
 let settings=readSettings();
 let state=readGame(),runStarted=null,appActive=true,selected=40,notesMode=false;
 let saveOK=true,statsSaveFailed=false,toastTimer=null;
 const boardButtons=[];
 function storageGet(key){try{return localStorage.getItem(key)}catch{return null}}
 function storageSet(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));saveOK=true;return true}
  catch{saveOK=false;return false}
 }
 function safeCounter(n){return Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:0}
 function readStats(){
  const raw=(()=>{try{return JSON.parse(storageGet(STATS_KEY)||"null")}catch{return null}})();
  const byLevel={};
  for(const level of Object.keys(LEVELS)){
   byLevel[level]={wins:safeCounter(raw?.byLevel?.[level]?.wins),
    losses:safeCounter(raw?.byLevel?.[level]?.losses)};
  }
  return {wins:safeCounter(raw?.wins),losses:safeCounter(raw?.losses),byLevel};
 }
 let stats=readStats();
 function updateStatsView(){
  $("statsWins").textContent=String(stats.wins);
  $("statsLosses").textContent=String(stats.losses);
  const labels={easy:"Εύκολο",medium:"Μέτριο",hard:"Δύσκολο",expert:"Ειδικός"};
  $("statsDetail").textContent="Ανά επίπεδο (λυμένα / εγκαταλείψεις): "+
   Object.keys(LEVELS).map(level=>labels[level]+" "+stats.byLevel[level].wins+
    "/"+stats.byLevel[level].losses).join(" · ")+". Η παύση δεν μετρά ως ήττα.";
 }
 function recordResult(kind){
  if(stats[kind]>=999999999||stats.byLevel[state.level][kind]>=999999999)return;
  stats[kind]++;stats.byLevel[state.level][kind]++;
  statsSaveFailed=!storageSet(STATS_KEY,stats);
  updateStatsView();
 }
 function readSettings(){
  try{
   const value=JSON.parse(storageGet(SETTINGS_KEY)||"null");
   return {difficulty:LEVELS[value?.difficulty]?value.difficulty:"medium",
    showErrors:typeof value?.showErrors==="boolean"?value.showErrors:true};
  }catch{return {...DEFAULT}}
 }
 function isBoard(a){return Array.isArray(a)&&a.length===81&&a.every(v=>Number.isInteger(v)&&v>=0&&v<=9)}
 function validGame(v){
  if(!v||v.version!==1||!isBoard(v.puzzle)||!isBoard(v.solution)||!isBoard(v.values))return false;
  if(!LEVELS[v.level]||v.solution.includes(0)||Engine.countSolutions(v.solution,2)!==1)return false;
  if(!v.puzzle.every((x,i)=>x===0||x===v.solution[i]))return false;
  if(!v.values.every((x,i)=>v.puzzle[i]===0||x===v.puzzle[i]))return false;
  if(!Array.isArray(v.notes)||v.notes.length!==81||
    !v.notes.every(x=>Number.isInteger(x)&&x>=0&&x<=1022))return false;
  if(!Number.isFinite(v.elapsedMs)||v.elapsedMs<0||v.elapsedMs>1000*60*60*24*1000)return false;
  return true;
 }
 function readGame(){
  try{
   const text=storageGet(GAME_KEY);
   if(!text)return null;
   const value=JSON.parse(text);
   if(!validGame(value))return null;
   return {version:1,puzzle:value.puzzle,solution:value.solution,values:value.values,
    notes:value.notes,elapsedMs:value.elapsedMs,paused:true,
    completed:Boolean(value.completed),level:value.level,history:Array.isArray(value.history)?
     value.history.filter(h=>Number.isInteger(h.i)&&h.i>=0&&h.i<81&&
       Number.isInteger(h.value)&&h.value>=0&&h.value<=9&&
       Number.isInteger(h.note)&&h.note>=0&&h.note<=1022).slice(-120):[]};
  }catch{return null}
 }
 function createGame(level){
  const {puzzle,solution}=Engine.generate(level);
  return {version:1,puzzle,solution,values:[...puzzle],notes:Array(81).fill(0),
   elapsedMs:0,paused:true,completed:false,level,history:[]};
 }
 if(!state)state=createGame(settings.difficulty);
 else selected=state.values.findIndex((v,i)=>!v&&!state.puzzle[i]);
 if(selected<0)selected=40;
 function elapsed(){return state.elapsedMs+(runStarted===null?0:Math.max(0,Date.now()-runStarted))}
 function save(){
  const snapshot={...state,elapsedMs:elapsed(),paused:state.paused};
  storageSet(GAME_KEY,snapshot);
  const notice=$("saveNote");
  notice.hidden=saveOK&&!statsSaveFailed;
  if(!saveOK||statsSaveFailed)notice.textContent="⚠️ Η αποθήκευση παιχνιδιού ή στατιστικών απέτυχε. Ελευθέρωσε χώρο πριν κλείσεις την εφαρμογή.";
 }
 function formatTime(ms){
  const secs=Math.floor(ms/1000),h=Math.floor(secs/3600),m=Math.floor(secs%3600/60),s=secs%60;
  const pad=x=>String(x).padStart(2,"0");
  return h?pad(h)+":"+pad(m)+":"+pad(s):pad(m)+":"+pad(s);
 }
 function pauseGame(){
  if(state.paused||state.completed){save();return}
  state.elapsedMs=elapsed();runStarted=null;state.paused=true;save();render();
 }
 function resume(){
  if(state.completed)return;
  if(document.hidden||!appActive){toast("Άνοιξε πρώτα την καρτέλα Sudoku.");return}
  if(!state.paused)return;
  state.paused=false;runStarted=Date.now();save();render();
 }
 function toast(message){
  const el=$("toast");el.textContent=message;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2400);
 }
 function makeCells(){
  const board=$("board");
  const frag=document.createDocumentFragment();
  for(let i=0;i<81;i++){
   const cell=document.createElement("button");cell.type="button";
   cell.className="sudoku-cell";cell.dataset.index=String(i);
   cell.dataset.row=String(Math.floor(i/9));cell.dataset.col=String(i%9);
   cell.setAttribute("role","gridcell");
   cell.addEventListener("click",()=>{if(state.paused||state.completed)return;selected=i;render()});
   boardButtons.push(cell);frag.appendChild(cell);
  }
  board.appendChild(frag);
 }
 function render(){
  const filled=state.values.filter(Boolean).length;
  $("progress").textContent=filled+"/81";
  $("timer").textContent=formatTime(elapsed());
  $("gameStatus").textContent=state.completed?"Ολοκληρώθηκε!":state.paused?"Σε παύση":"Σε εξέλιξη";
  const overlay=$("pauseOverlay");
  overlay.hidden=!state.paused&&!state.completed;
  $("pauseTitle").textContent=state.completed?"Συγχαρητήρια!":"Σε παύση";
  $("pauseDescription").textContent=state.completed?
   "Έλυσες σωστά ολόκληρο το Sudoku.":"Το παιχνίδι έχει αποθηκευτεί. Ο χρόνος δεν μετρά.";
  $("resumeButton").textContent=state.completed?"＋ Νέο παιχνίδι":"▶ Συνέχεια";
  $("pauseButton").querySelector(".action-icon").textContent=state.paused||state.completed?"▶":"Ⅱ";
  $("pauseLabel").textContent=state.paused||state.completed?"Συνέχεια":"Παύση";
  $("pauseButton").setAttribute("aria-label",state.paused||state.completed?"Συνέχεια παιχνιδιού":"Παύση παιχνιδιού");
  $("pauseButton").disabled=state.completed;
  $("notesButton").setAttribute("aria-pressed",String(notesMode));
  $("undoButton").disabled=state.paused||state.completed||!state.history.length;
  $("eraseButton").disabled=state.paused||state.completed;
  $("notesButton").disabled=state.paused||state.completed;
  // A digit is complete only after all nine of its positions are correct.
  // Keep the nine keypad slots in place so the remaining buttons never move.
  const correctCounts=Array(10).fill(0);
  for(let i=0;i<81;i++){
   const value=state.values[i];
   if(value&&value===state.solution[i])correctCounts[value]++;
  }
  for(const button of $("numberPad").querySelectorAll("[data-number]")){
   const digit=Number(button.dataset.number),finished=correctCounts[digit]===9;
   button.classList.toggle("is-complete",finished);
   button.disabled=finished;
   button.setAttribute("aria-label",finished?
    "Ο αριθμός "+digit+" ολοκληρώθηκε":"Αριθμός "+digit);
  }
  const selectedValue=state.values[selected];
  const selectedRow=Math.floor(selected/9),selectedCol=selected%9;
  const selectedBlockRow=Math.floor(selectedRow/3),selectedBlockCol=Math.floor(selectedCol/3);
  for(let i=0;i<81;i++){
   const cell=boardButtons[i],value=state.values[i],isFixed=!!state.puzzle[i];
   const row=Math.floor(i/9),col=i%9;
   const isSelected=selected===i;
   const sameRow=row===selectedRow,sameCol=col===selectedCol;
   const sameBox=Math.floor(row/3)===selectedBlockRow&&Math.floor(col/3)===selectedBlockCol;
   const isSame=!!value&&!!selectedValue&&selectedValue===value;
   const wrong=!!(settings.showErrors&&value&&!isFixed&&value!==state.solution[i]);
   // Orientation only: no candidate calculation or use of the solution for highlights.
   cell.className="sudoku-cell"+(isFixed?" given":"")+
     (sameBox?" box-peer":"")+(sameRow?" row-peer":"")+(sameCol?" col-peer":"")+
     (isSame?" same":"")+(isSelected?" selected":"")+(wrong?" wrong":"");
   cell.replaceChildren();
   if(value){cell.textContent=String(value)}
   else if(state.notes[i]){
    const grid=document.createElement("span");grid.className="cell-notes";
    for(let digit=1;digit<=9;digit++){
     const n=document.createElement("span");
     n.textContent=(state.notes[i]&(1<<digit))?String(digit):"";
     grid.appendChild(n);
    }
    cell.appendChild(grid);
   }
   cell.setAttribute("aria-selected",String(isSelected));
   const description=value?String(value):"κενό";
   cell.setAttribute("aria-label","Γραμμή "+(Math.floor(i/9)+1)+", στήλη "+(i%9+1)+
      ", "+description+(isFixed?", σταθερό":""));
  }
 }
 function recordHistory(i){
  state.history.push({i,value:state.values[i],note:state.notes[i]});
  if(state.history.length>120)state.history.shift();
 }
 function completed(){
  return state.values.every((v,i)=>v===state.solution[i]);
 }
 function enterNumber(digit){
  if(state.paused||state.completed)return;
  if(!Number.isInteger(digit)||digit<1||digit>9||state.puzzle[selected])return;
  if(notesMode){
   recordHistory(selected);
   state.values[selected]=0;state.notes[selected]^=1<<digit;
  }else{
   if(state.values[selected]===digit&&state.notes[selected]===0)return;
   recordHistory(selected);
   state.values[selected]=digit;state.notes[selected]=0;
  }
  if(completed()){
   state.elapsedMs=elapsed();runStarted=null;state.paused=true;state.completed=true;
   recordResult("wins");
   toast("🎉 Το ολοκλήρωσες!");
  }
  save();render();
 }
 function erase(){
  if(state.paused||state.completed||state.puzzle[selected])return;
  if(!state.values[selected]&&!state.notes[selected])return;
  recordHistory(selected);
  state.values[selected]=0;state.notes[selected]=0;save();render();
 }
 function undo(){
  if(state.paused||state.completed)return;
  const prior=state.history.pop();
  if(!prior)return;
  state.values[prior.i]=prior.value;state.notes[prior.i]=prior.note;
  selected=prior.i;save();render();
 }
 async function newGame(){
  if(!state.completed&&!await GameDialog.confirm("Να ξεκινήσει νέα παρτίδα; Η τρέχουσα θα αντικατασταθεί."))return;
  // A paused game is still active. Count an abandonment only when the player
  // explicitly confirms replacing a puzzle where they have made moves.
  if(!state.completed&&state.history.length>0)recordResult("losses");
  state=createGame(settings.difficulty);runStarted=null;
  selected=state.puzzle.findIndex(x=>x===0);
  notesMode=false;save();render();
  toast("Νέο Sudoku: "+LEVELS[state.level].label);
 }
 function showSettings(){
  pauseGame();
  for(const el of document.querySelectorAll('input[name="difficulty"]'))
    el.checked=el.value===settings.difficulty;
  $("showErrors").checked=settings.showErrors;
  $("settingsDialog").showModal();
 }
 function closeSettings(){if($("settingsDialog").open)$("settingsDialog").close()}
function refreshFullscreenButton(){
 const active=Boolean(document.fullscreenElement);
 const btn=$("fullscreenButton");
 btn.setAttribute("aria-pressed",String(active));
 btn.setAttribute("aria-label",active?"Έξοδος από πλήρη οθόνη":"Πλήρης οθόνη");
 $("fullscreenLabel").textContent=active?"Έξοδος από πλήρη οθόνη":"Πλήρης οθόνη";
}
async function toggleFullscreen(){
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else{
   if(typeof document.documentElement.requestFullscreen!=="function")throw Error("Unsupported");
   await document.documentElement.requestFullscreen();
  }
 }catch{
  toast("Δεν επιτρέπεται η πλήρης οθόνη εδώ. Δοκίμασε το F11.");
 }
 refreshFullscreenButton();
}
 makeCells();updateStatsView();render();save();
 $("numberPad").addEventListener("click",event=>{
  const button=event.target.closest("[data-number]");
  if(button)enterNumber(Number(button.dataset.number));
 });
 $("notesButton").addEventListener("click",()=>{
  if(state.paused||state.completed)return;
  notesMode=!notesMode;render();
 });
 $("eraseButton").addEventListener("click",erase);
 $("undoButton").addEventListener("click",undo);
 $("pauseButton").addEventListener("click",()=>state.paused?resume():pauseGame());
 $("resumeButton").addEventListener("click",()=>state.completed?newGame():resume());
 $("newButton").addEventListener("click",()=>{pauseGame();newGame()});
 $("settingsButton").addEventListener("click",showSettings);
$("fullscreenButton").addEventListener("click",toggleFullscreen);
document.addEventListener("fullscreenchange",refreshFullscreenButton);
document.addEventListener("fullscreenerror",()=>toast("Η πλήρης οθόνη δεν επιτρέπεται από τον browser."));
refreshFullscreenButton();
 $("closeSettings").addEventListener("click",closeSettings);
 $("settingsForm").addEventListener("submit",event=>{
  event.preventDefault();
  const checked=document.querySelector('input[name="difficulty"]:checked');
  settings={difficulty:LEVELS[checked?.value]?checked.value:"medium",
    showErrors:$("showErrors").checked};
  storageSet(SETTINGS_KEY,settings);closeSettings();render();
  toast("Οι ρυθμίσεις αποθηκεύτηκαν. Η δυσκολία ισχύει στο επόμενο παιχνίδι.");
 });
 document.addEventListener("keydown",event=>{
  if($("settingsDialog").open||event.altKey||event.metaKey)return;
  if(event.ctrlKey&&event.key.toLowerCase()==="z"){event.preventDefault();undo();return}
  if(state.paused||state.completed)return;
  if(/^[1-9]$/.test(event.key)){enterNumber(Number(event.key));return}
  if(event.key==="Delete"||event.key==="Backspace"||event.key==="0"){event.preventDefault();erase();return}
  if(event.key.toLowerCase()==="n"){notesMode=!notesMode;render();return}
  const r=Math.floor(selected/9),c=selected%9;
  const move={ArrowLeft:r*9+Math.max(0,c-1),ArrowRight:r*9+Math.min(8,c+1),
   ArrowUp:Math.max(0,r-1)*9+c,ArrowDown:Math.min(8,r+1)*9+c};
  if(Object.prototype.hasOwnProperty.call(move,event.key)){
   event.preventDefault();selected=move[event.key];render();boardButtons[selected].focus();
  }
 });
 window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.origin!==location.origin)return;
  if(event.data?.type!=="sudokufunny:visibility")return;
  appActive=event.data.active===true;
  if(!appActive)pauseGame();
 });
 document.addEventListener("visibilitychange",()=>{if(document.hidden)pauseGame()});
 window.addEventListener("pagehide",pauseGame);
 window.addEventListener("blur",()=>{if(!$("settingsDialog").open)pauseGame()});
 window.addEventListener("storage",event=>{
  if(event.key===STATS_KEY){stats=readStats();statsSaveFailed=false;updateStatsView();return}
  if(event.key!==GAME_KEY||!event.newValue)return;
  const latest=readGame();
  if(!latest)return;
  runStarted=null;state=latest;selected=state.values.findIndex((v,i)=>!v&&!state.puzzle[i]);
  if(selected<0)selected=40;
  render();toast("Η παρτίδα ενημερώθηκε από άλλη καρτέλα.");
 });
 setInterval(()=>{if(!state.paused){$("timer").textContent=formatTime(elapsed());save()}},5000);
 if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"}).catch(()=>{}),{once:true});
 }
})();
