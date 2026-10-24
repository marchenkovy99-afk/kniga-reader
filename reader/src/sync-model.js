export function mergeMarks(...groups){
 const map=new Map();
 for(const mark of groups.flat()){
  if(!mark?.anchor||!Number.isInteger(mark.anchor.block)||!Number.isInteger(mark.anchor.offset)||mark.anchor.block<0||mark.anchor.offset<0)continue;
  const key=mark.anchor.block+':'+mark.anchor.offset;const previous=map.get(key);
  if(!previous||(mark.changedAt||0)>=(previous.changedAt||0))map.set(key,{anchor:mark.anchor,label:String(mark.label||'Закладка').slice(0,200),changedAt:Number(mark.changedAt)||0,deleted:!!mark.deleted});
 }
 return [...map.values()];
}
export function newestState(records,key){return records.filter(x=>x.key===key&&Number.isFinite(x.clientUpdatedAt)).sort((a,b)=>b.clientUpdatedAt-a.clientUpdatedAt)[0]||null;}

/**
 * Pending writes belong to the account that created them. Guest edits may be
 * adopted on first sign-in, but must never leak from account A to account B.
 * Prefer the newest write when both queues contain the same key.
 */
export function pendingForAccount(previousOwner,nextOwner,previousPending={},accountPending={}){
 if(!nextOwner)throw new Error('Не указан владелец облачной библиотеки.');
 const merge=(a,b)=>{
  const out={...a};
  for(const [key,record] of Object.entries(b||{})){
   if(!record||!Number.isFinite(Number(record.clientUpdatedAt)))continue;
   if(!out[key]||Number(record.clientUpdatedAt)>=Number(out[key].clientUpdatedAt))out[key]=record;
  }
  return out;
 };
 return previousOwner&&previousOwner!==nextOwner
  ?merge({},accountPending)
  :merge(previousPending,accountPending);
}
