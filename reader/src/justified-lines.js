/** Minimize paragraph-wide space expansion instead of filling each line greedily.
 * measure(from,to) returns the natural width of original, formatted DOM text. */
export function planJustifiedLines({text,breaks,width,indent=0,spaceWidth,measure,hyphenWidth}){
 const points=[{at:0,end:0,hyphen:false},...breaks];
 const costs=new Array(points.length).fill(Infinity),totals=new Array(points.length).fill(Infinity),next=new Array(points.length);
 costs[points.length-1]=0;totals[points.length-1]=0;
 for(let i=points.length-2;i>=0;i--){
  const from=points[i].at,available=width-(i===0?indent:0);
  for(let j=i+1;j<points.length;j++){
   const point=points[j],natural=measure(from,point.end)+(point.hyphen?hyphenWidth:0);
   const spaces=(text.slice(from,point.end).match(/\s+/g)||[]).length;
   // A little space contraction can admit a whole word and avoid a very loose
   // neighbouring line. Glyph widths and the user's letter spacing stay intact.
   if(natural>available+spaces*spaceWidth*.25){if(natural>available+width*.1)break;continue;}
   const extra=Math.max(0,available-natural),last=j===points.length-1;
   const stretch=extra/Math.max(1,spaces)/Math.max(1,spaceWidth);
   // First minimize the worst stretched line, then total spacing and hyphens.
   const expansion=last?0:stretch*stretch,worst=Math.max(expansion,costs[j]);
   const total=expansion+(point.hyphen?.6:0)+(natural>available?.5:0)+(last&&natural<width*.25&&i>0?8:0)+totals[j];
   if(worst<costs[i]-.001||Math.abs(worst-costs[i])<.001&&total<totals[i]){costs[i]=worst;totals[i]=total;next[i]=j;}
  }
 }
 if(!Number.isFinite(costs[0]))return null; // Very narrow/large text uses native wrapping.
 const lines=[];
 for(let i=0;i<points.length-1;){
  const j=next[i];if(!(j>i))return null;
  const from=points[i].at,point=points[j],available=width-(i===0?indent:0),natural=measure(from,point.end)+(point.hyphen?hyphenWidth:0),spaces=(text.slice(from,point.end).match(/\s+/g)||[]).length;
  lines.push({from,to:point.at,hyphen:point.hyphen,tighten:natural>available?-(natural-available+.1)/Math.max(1,spaces):0});i=j;
 }
 return lines;
}
