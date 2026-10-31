/** Opt-in, bounded diagnostic trace for installed iOS PWAs.
 * Enable with ?readerTrace=1; disable with ?readerTrace=0.
 * The trace never contains book contents, quote text or account credentials.
 * Read it from localStorage['libra-reading-trace-v1'].
 */
const FLAG='libra-reading-trace-enabled';
const KEY='libra-reading-trace-v1';
const LIMIT=150;
export type ReadingTraceEvent={at:number;event:string;values:Record<string,string|number|boolean|null|undefined>};
export function traceReading(event:string,values:ReadingTraceEvent['values']={}):void{
 try{
  const query=new URLSearchParams(window.location.search).get('readerTrace');
  if(query==='1')localStorage.setItem(FLAG,'1');
  if(query==='0'){localStorage.removeItem(FLAG);return}
  if(localStorage.getItem(FLAG)!=='1')return;
  const current=JSON.parse(localStorage.getItem(KEY)||'[]') as ReadingTraceEvent[];
  const next=[...Array.isArray(current)?current:[],{at:Date.now(),event,values}].slice(-LIMIT);
  localStorage.setItem(KEY,JSON.stringify(next));
  console.info('[Libra reading]',event,values);
 }catch{/* Diagnostics must never interrupt reading or persistence. */}
}
export function readReadingTrace():ReadingTraceEvent[]{
 try{return JSON.parse(localStorage.getItem(KEY)||'[]') as ReadingTraceEvent[]}
 catch{return []}
}
