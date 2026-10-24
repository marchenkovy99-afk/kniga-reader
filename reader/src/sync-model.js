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

/** Typography has an independent timestamp and sync key. A later page turn
 * cannot replace a newer font size, theme, margin or line spacing. */
export const bookAppearanceKey=id=>'appearance:'+id;
/** Reading progress timestamps are NOT typography timestamps. In old builds a
 * page turn copied bookSettings but did not mean their appearance was edited. */
export function legacyAppearanceTimestamp(progress){
 const timestamp=Number(progress?.appearanceUpdatedAt);
 return Number.isFinite(timestamp)&&timestamp>0?timestamp:0;
}
export function latestBookAppearance(states,id){
 const key=bookAppearanceKey(id);
 const active=states.filter(r=>r.key===key&&r.payload&&typeof r.payload==='object');
 if(active.length)return newestState(active,key);
 const legacy=states.filter(r=>r.key==='position:'+id&&r.payload?.bookSettings&&typeof r.payload.bookSettings==='object'&&legacyAppearanceTimestamp(r.payload)>0);
 // A recently turned page must never resurrect unstamped, years-old typography.
 const last=legacy.sort((a,b)=>legacyAppearanceTimestamp(b.payload)-legacyAppearanceTimestamp(a.payload))[0];
 if(!last)return null;
 return {key,deviceId:last.deviceId,payload:last.payload.bookSettings,clientUpdatedAt:legacyAppearanceTimestamp(last.payload),legacy:true};
}
export function preferRemoteAppearance(localAt,remoteAt,hasPending=false){
 return !hasPending&&Number.isFinite(Number(remoteAt))&&Number(remoteAt)>Number(localAt||0);
}

/** Use only typography revisions; reading progress is never a typography edit. */
export function latestReadingSettings(records){
 return records.filter(r=>(r.key==='settings'||r.key.startsWith('appearance:'))&&r.payload&&typeof r.payload==='object'&&Number.isFinite(r.clientUpdatedAt))
  .sort((a,b)=>b.clientUpdatedAt-a.clientUpdatedAt||Number(b.key==='settings')-Number(a.key==='settings'))[0]||null;
}
export function resolveReadingAppearance(account,book){
 return book?.settings&&Number(book.updatedAt)>Number(account?.updatedAt||0)?book:account;
}
