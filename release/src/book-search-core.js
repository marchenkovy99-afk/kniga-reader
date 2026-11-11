// Literal, local search with UTF-16 offsets into the original text.
function* normalizationWork(text) {
  let value='',starts=[],ends=[],space=false,checkpoint=4096;
  for(let offset=0;offset<text.length;){
    if(offset>=checkpoint){checkpoint=offset+4096;yield;}
    const char=String.fromCodePoint(text.codePointAt(offset)),end=offset+char.length;
    if(/[\u00ad\u200b\ufeff]/u.test(char)){offset=end;continue;}
    if(/\s/u.test(char)){
      if(value&&!space){value+=' ';starts.push(offset);ends.push(end);space=true;}
      else if(space)ends[ends.length-1]=end;
    }else{
      const folded=char.toLowerCase().replace(/ё/g,'е');
      value+=folded;for(let i=0;i<folded.length;i++){starts.push(offset);ends.push(end);}space=false;
    }
    offset=end;
  }
  if(space){value=value.slice(0,-1);starts.pop();ends.pop();}
  return {value,starts,ends};
}

function finish(work){let step;do{step=work.next();}while(!step.done);return step.value;}
export function normalizeText(text){return finish(normalizationWork(text));}

function* indexWork(units) {
  let text='',count=0;const entries=[];
  for(const unit of units){
    if(++count%256===0)yield;
    if(!unit.text)continue;
    if(text)text+=unit.separatorBefore??' ';
    const start=text.length;text+=unit.text;
    entries.push({unit,start,end:text.length});
  }
  return {text,entries,...yield* normalizationWork(text)};
}
export function createTextIndex(units){return finish(indexWork(units));}

// Yield a task, not a microtask or an rAF callback: input and rendering must
// get a chance to run even inside one very long chapter. Keep one shared
// normalization algorithm so chunk boundaries cannot alter source offsets.
export function yieldSearchTask(){
  if(globalThis.scheduler?.yield)return globalThis.scheduler.yield();
  if(typeof MessageChannel==='undefined')return new Promise(resolve=>setTimeout(resolve,0));
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
    channel.port2.postMessage(null);
  });
}
export async function createTextIndexAsync(units,{signal,yieldTask=yieldSearchTask}={}){
  const work=indexWork(units);
  for(;;){
    signal?.throwIfAborted();await yieldTask();signal?.throwIfAborted();
    const step=work.next();if(step.done)return step.value;
  }
}

function pointAt(entries,offset,end=false){
  let lo=0,hi=entries.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(entries[mid].end<offset||(!end&&entries[mid].end===offset))lo=mid+1;else hi=mid;}
  const entry=entries[Math.min(lo,entries.length-1)];
  return {unit:entry.unit,offset:Math.max(0,Math.min(entry.unit.text.length,offset-entry.start))};
}

export function findMatches(index,query,{limit=10000,signal}={}) {
  signal?.throwIfAborted();
  const needle=normalizeText(query).value;if(!needle)return [];
  const found=[];let offset=0;
  while(found.length<limit){
    signal?.throwIfAborted();const at=index.value.indexOf(needle,offset);if(at<0)break;
    const start=index.starts[at],end=index.ends[at+needle.length-1];
    found.push({start,end,first:pointAt(index.entries,start),last:pointAt(index.entries,end,true)});
    offset=at+Math.max(1,needle.length);
  }
  return found;
}

/** A source location survives changes to physical page dimensions. */
export function matchTarget(match){
  if(match.cfi)return {chapter:match.chapter,cfi:match.cfi};
  const unit=match.first.unit;
  const prefix=unit.cell===undefined?0:match.entry.index.entries.reduce((sum,entry)=>
    sum+(entry.unit.block===unit.block&&entry.unit.cell<unit.cell?entry.unit.text.length:0),0);
  return {chapter:match.chapter,anchor:{block:unit.block,textNode:0,offset:prefix+match.first.offset}};
}
