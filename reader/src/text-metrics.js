/** Token widths are measured once. Candidate lines then sum cached widths,
 * instead of querying browser layout for every pair of break opportunities. */
export function createTextMeasure(runs,widthOf){
 const tokens=[],prefix=[0];let previousSpace=false;
 for(const run of runs)for(const match of run.text.matchAll(/[ \t\r\n]+|[^ \t\r\n]+/g)){
  const space=/^[ \t\r\n]+$/.test(match[0]),text=space?' ':match[0];
  const token={start:run.start+match.index,end:run.start+match.index+match[0].length,text,font:run.font,space,width:space&&previousSpace?0:widthOf(text,run.font)};
  tokens.push(token);prefix.push(prefix.at(-1)+token.width);previousSpace=space;
 }
 const find=offset=>{let lo=0,hi=tokens.length;while(lo<hi){const mid=(lo+hi)>>1;if(tokens[mid].end<=offset)lo=mid+1;else hi=mid;}return lo;};
 const partial=(token,from,to)=>token.space?token.width:widthOf(token.text.slice(from-token.start,to-token.start),token.font);
 return (from,to)=>{
  if(to<=from||!tokens.length)return 0;
  const first=find(from),last=find(to-1);
  if(first===last)return partial(tokens[first],from,to);
  return partial(tokens[first],from,tokens[first].end)+prefix[last]-prefix[first+1]+partial(tokens[last],tokens[last].start,to);
 };
}
