(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.SudokuFunnyEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const FULL=0x3fe;
  const LEVELS=Object.freeze({
    easy:{label:"Εύκολο",clues:42},
    medium:{label:"Μέτριο",clues:36},
    hard:{label:"Δύσκολο",clues:32},
    expert:{label:"Ειδικός",clues:28}
  });
  const range=n=>Array.from({length:n},(_,i)=>i);
  function shuffle(array,random=Math.random){
    const a=[...array];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.min(.999999999,Math.max(0,random()))*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  function makeSolution(random=Math.random){
    const bands=shuffle(range(3),random);
    const rows=bands.flatMap(b=>shuffle(range(3),random).map(i=>b*3+i));
    const stacks=shuffle(range(3),random);
    const cols=stacks.flatMap(b=>shuffle(range(3),random).map(i=>b*3+i));
    const digits=shuffle(range(9).map(i=>i+1),random);
    const pattern=(r,c)=>(r*3+Math.floor(r/3)+c)%9;
    return rows.flatMap(r=>cols.map(c=>digits[pattern(r,c)]));
  }
  function countSolutions(input,limit=2){
    if(!Array.isArray(input)||input.length!==81)return 0;
    const board=[...input],rows=range(9).map(()=>0),cols=range(9).map(()=>0),
      boxes=range(9).map(()=>0);
    for(let i=0;i<81;i++){
      const v=board[i];
      if(!Number.isInteger(v)||v<0||v>9)return 0;
      if(!v)continue;
      const r=Math.floor(i/9),c=i%9,b=Math.floor(r/3)*3+Math.floor(c/3),bit=1<<v;
      if((rows[r]|cols[c]|boxes[b])&bit)return 0;
      rows[r]|=bit;cols[c]|=bit;boxes[b]|=bit;
    }
    let found=0;
    function visit(){
      if(found>=limit)return;
      let best=-1,bestMask=0,bestCount=10;
      for(let i=0;i<81;i++){
        if(board[i])continue;
        const r=Math.floor(i/9),c=i%9,b=Math.floor(r/3)*3+Math.floor(c/3);
        const mask=FULL&~(rows[r]|cols[c]|boxes[b]);
        let count=0;
        for(let z=mask;z;z&=z-1)count++;
        if(count===0)return;
        if(count<bestCount){best=i;bestCount=count;bestMask=mask;if(count===1)break;}
      }
      if(best===-1){found++;return;}
      const r=Math.floor(best/9),c=best%9,b=Math.floor(r/3)*3+Math.floor(c/3);
      for(let digits=bestMask;digits&&found<limit;digits&=digits-1){
        const bit=digits&-digits,v=31-Math.clz32(bit);
        board[best]=v;rows[r]|=bit;cols[c]|=bit;boxes[b]|=bit;
        visit();
        board[best]=0;rows[r]^=bit;cols[c]^=bit;boxes[b]^=bit;
      }
    }
    visit();
    return found;
  }
  function generate(level="medium",random=Math.random){
    if(!Object.prototype.hasOwnProperty.call(LEVELS,level))level="medium";
    const clues=LEVELS[level].clues;
    let best=null;
    for(let attempt=0;attempt<3;attempt++){
      const solution=makeSolution(random),puzzle=[...solution];
      for(const i of shuffle(range(81),random)){
        if(puzzle.filter(Boolean).length<=clues)break;
        const old=puzzle[i];puzzle[i]=0;
        if(countSolutions(puzzle,2)!==1)puzzle[i]=old;
      }
      const result={puzzle,solution,level,clues:puzzle.filter(Boolean).length};
      if(!best||result.clues<best.clues)best=result;
      if(result.clues<=clues)break;
    }
    return best;
  }
  function candidates(board,index){
    if(!Array.isArray(board)||board.length!==81||!Number.isInteger(index)||index<0||index>80)return [];
    const r=Math.floor(index/9),c=index%9,filled=new Set();
    for(let k=0;k<9;k++){
      filled.add(board[r*9+k]);filled.add(board[k*9+c]);
      filled.add(board[(Math.floor(r/3)*3+Math.floor(k/3))*9+Math.floor(c/3)*3+k%3]);
    }
    return range(9).map(i=>i+1).filter(v=>!filled.has(v));
  }
  return Object.freeze({LEVELS,makeSolution,countSolutions,generate,candidates});
});
