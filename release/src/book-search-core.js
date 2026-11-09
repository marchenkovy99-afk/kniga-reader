// Literal, local search with UTF-16 offsets into the original text.
export function normalizeText(text) {
  let value='',starts=[],ends=[],space=false;
  for(let offset=0;offset<text.length;){
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

export function createTextIndex(units) {
  let text='';const entries=[];
  for(const unit of units){
    if(!unit.text)continue;
    if(text)text+=unit.separatorBefore??' ';
    const start=text.length;text+=unit.text;
    entries.push({unit,start,end:text.length});
  }
  return {text,entries,...normalizeText(text)};
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
