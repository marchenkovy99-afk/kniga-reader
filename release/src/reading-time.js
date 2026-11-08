// A short heartbeat bounds time lost to abrupt iOS suspension; no background catch-up.
export function createReadingClock({now=()=>performance.now(),onTime}){
 let active=false,last=now();
 function flush(){const next=now(),elapsed=next-last;last=next;if(active&&elapsed>0&&elapsed<=5000)onTime(elapsed);}
 return {flush,setActive(value){const next=Boolean(value);if(next===active)return;flush();active=next;}};
}
export function formatReadingTime(ms){
 const minutes=Math.floor(Math.max(0,Number(ms)||0)/60000);
 return minutes>=60?`${Math.floor(minutes/60)} ч ${minutes%60} мин`:`${minutes} мин`;
}
const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const componentPrefix='libra-reading-time:v2:';
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value));
const validMs=value=>Number.isSafeInteger(value)&&value>=0&&value<=3155760000000;
export function createReadingTimeStore(storage,replica){
 const prefix=owner=>componentPrefix+encodeURIComponent(owner)+':';
 const componentKey=(owner,row)=>prefix(owner)+[row.book_id,row.replica_id,row.day].map(encodeURIComponent).join(':');
 const ackKey=key=>'libra-reading-time-ack:'+key;
 const number=key=>{const n=Number(storage.getItem(key));return Number.isFinite(n)&&n>=0?n:0;};
 function entries(owner){
  const output=[];for(let i=0;i<storage.length;i++){
   const key=storage.key(i);if(!key?.startsWith(prefix(owner)))continue;
   const [book_id,replica_id,day]=key.slice(prefix(owner).length).split(':').map(decodeURIComponent),total_ms=Math.floor(number(key));
   if(validId(book_id)&&validId(replica_id)&&validDay(day)&&validMs(total_ms))output.push({book_id,replica_id,day,total_ms});
  }return output;
 }
 function put(owner,row){const key=componentKey(owner,row);storage.setItem(key,Math.max(number(key),row.total_ms));}
 function migrate(owner,book){
  const oldKey=`libra-reading-time:v1:${encodeURIComponent(owner)}:${encodeURIComponent(book)}`,marker='libra-reading-time-migrated:'+oldKey;
  if(storage.getItem(marker))return;
  let old;try{old=JSON.parse(storage.getItem(oldKey)||'null');}catch{}
  // Keep the marker's replica stable across an interrupted migration/reload.
  let legacy=storage.getItem('libra-reading-time-legacy-replica');
  if(!legacy){legacy='legacy-'+replica;storage.setItem('libra-reading-time-legacy-replica',legacy);}
  if(old?.version===1&&Number.isFinite(old.total)&&old.total>=0){
   const today=validDay(old.day)?Math.min(old.total,Math.max(0,Number(old.today)||0)):0;
   if(today)put(owner,{book_id:book,replica_id:legacy,day:old.day,total_ms:Math.round(today)});
   if(old.total>today)put(owner,{book_id:book,replica_id:legacy,day:'1970-01-01',total_ms:Math.round(old.total-today)});
  }storage.setItem(marker,'1');
 }
 function recoverUnscoped(owner,book){
  const malformed=value=>value==='true'||value==='false'||value.includes('=>')||/^\s*(?:async\s+)?function\b/.test(value);
  if(malformed(owner))return;
  const sources=new Set();for(let i=0;i<storage.length;i++){
   const key=storage.key(i);if(!key?.startsWith(componentPrefix)&&!key?.startsWith('libra-reading-time:v1:'))continue;
   const parts=key.split(':');let oldOwner,oldBook;try{oldOwner=decodeURIComponent(parts[2]);oldBook=decodeURIComponent(parts[3]);}catch{continue;}
   if(oldBook===book&&malformed(oldOwner))sources.add(oldOwner);
  }
  for(const oldOwner of sources){
   const claim='libra-reading-time-recovered-owner:'+encodeURIComponent(oldOwner)+':'+encodeURIComponent(book),claimed=storage.getItem(claim);
   if(claimed&&claimed!==owner)continue;
   migrate(oldOwner,book);const rows=entries(oldOwner).filter(row=>row.book_id===book);if(!rows.length)continue;
   storage.setItem(claim,owner);for(const row of rows)put(owner,row);
  }
 }
 function summary(owner,book,day){recoverUnscoped(owner,book);migrate(owner,book);let total=0,today=0;for(const row of entries(owner))if(row.book_id===book){total+=row.total_ms;if(row.day===day)today+=row.total_ms;}return {total,today,day,version:2};}
 function add(owner,book,ms,day){
  migrate(owner,book);const row={book_id:book,replica_id:replica,day,total_ms:0};const key=componentKey(owner,row);
  storage.setItem(key,number(key)+Math.round(ms));
  const result=summary(owner,book,day);
  // Retain a readable compatibility snapshot; the migration marker prevents re-import.
  storage.setItem(`libra-reading-time:v1:${encodeURIComponent(owner)}:${encodeURIComponent(book)}`,JSON.stringify({...result,version:1}));return result;
 }
 function merge(owner,rows){for(const row of rows){if(!validId(row.book_id)||!validId(row.replica_id)||!validDay(row.day)||!validMs(row.total_ms))throw Error('Некорректное время чтения из облака');put(owner,row);const key=componentKey(owner,row);storage.setItem(ackKey(key),Math.max(number(ackKey(key)),row.total_ms));}}
 function pending(owner){return entries(owner).filter(row=>row.total_ms>number(ackKey(componentKey(owner,row))));}
 function acknowledge(owner,rows){for(const row of rows){const key=ackKey(componentKey(owner,row));storage.setItem(key,Math.max(number(key),row.total_ms));}}
 function adoptGuest(owner,books){
  for(const book of books){
   const claim='libra-reading-time-guest-owner:'+encodeURIComponent(book),claimed=storage.getItem(claim);
   if(claimed&&claimed!==owner)continue;
   migrate('guest',book);const guest=entries('guest').filter(row=>row.book_id===book);if(!guest.length)continue;
   storage.setItem(claim,owner);for(const row of guest)put(owner,row);
  }
 }
 return {add,summary,rows:entries,merge,pending,acknowledge,migrate,adoptGuest};
}
export function createReadingTimeSync({store,context,transport,onChange=()=>{}}){
 let running=null;
 return function sync(){
  if(running)return running;
  running=(async()=>{
   const start=await context();if(!start.enabled||!start.owner)return;
   const owner=start.owner,check=async()=>{const next=await context();return next.enabled&&next.owner===owner;};
   for(const book of start.books||[])store.migrate(owner,book);
   store.adoptGuest(owner,start.books||[]);
   const pending=store.pending(owner);
   for(let i=0;i<pending.length;i+=200){
    if(!await check())return;const batch=pending.slice(i,i+200);await transport.upload(batch,owner);
    if(!await check())return;store.acknowledge(owner,batch);
   }
   const remote=await transport.download(owner);if(!await check())return;
   store.merge(owner,remote);onChange();
  })().finally(()=>{running=null;});return running;
 };
}
const stores=new WeakMap();
function browserStore(win){if(!stores.has(win))stores.set(win,createReadingTimeStore(win.localStorage,win.crypto.randomUUID()));return stores.get(win);}
let cloudSync=null,cloudStatus='local';
function status(value){cloudStatus=value;if(typeof window!=='undefined')window.dispatchEvent(new Event('libra-reading-time-change'));}
export function configureReadingTimeCloud({client,deviceState,listBooks}){
 if(typeof window==='undefined')return;
 const win=window,store=browserStore(win);
 const context=async()=>{const device=await deviceState(),books=device.enabled?(await listBooks()).map(book=>book.id):[],latest=await deviceState();return {...device,enabled:device.enabled&&latest.enabled&&device.owner===latest.owner,books};};
 cloudSync=createReadingTimeSync({store,context,onChange:()=>win.dispatchEvent(new Event('libra-reading-time-change')),transport:{
  async upload(rows,owner){const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session?.user.id!==owner)throw Error('Войдите в свою учётную запись');const result=await client.rpc('libra_merge_reading_time',{p_components:rows});if(result.error)throw result.error;},
  async download(owner){const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session?.user.id!==owner)throw Error('Войдите в свою учётную запись');const rows=[];for(let offset=0;;offset+=500){const result=await client.from('libra_reading_time').select('book_id,replica_id,day,total_ms').eq('user_id',owner).order('book_id').order('replica_id').order('day').range(offset,offset+499);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<500)break;}return rows;}
 }});
 const sync=()=>{void syncReadingTimeCloud().catch(()=>{});};
 win.addEventListener('online',sync);win.addEventListener('pageshow',sync);
 document.addEventListener('visibilitychange',sync);win.addEventListener('libra-reading-time-flush',sync);
 win.setInterval(()=>{if(document.visibilityState==='visible')sync();},30000);
 client.auth.onAuthStateChange(()=>{status('local');win.setTimeout(sync,0);});sync();
}
export async function syncReadingTimeCloud(){
 if(!cloudSync||typeof navigator!=='undefined'&&navigator.onLine===false)return;
 try{await cloudSync();status('synced');}catch(error){status('pending');throw error;}
}
export function paintLibraryReadingTime(win,doc){
 const store=browserStore(win);
 for(const card of doc.querySelectorAll('[data-library-book][data-reading-owner]')){
  const progress=card.querySelector('.continue-progress-label,.book-tile-meta');if(!progress)continue;
  let label=card.querySelector('[data-libra-library-time]');
  if(!label){label=doc.createElement('span');label.dataset.libraLibraryTime='';label.style.cssText='display:block;color:var(--muted);font-size:13px;line-height:1.4;font-variant-numeric:tabular-nums;white-space:normal';progress.before(label);}
  const total=store.summary(card.dataset.readingOwner,card.dataset.libraryBook,dayKey(new Date())).total;
  const text='Чтение · '+formatReadingTime(total);if(label.textContent!==text)label.textContent=text;
 }
}
export function attachReadingTime(win,doc){
 let root=null,key=null,stats=null,suspended=false,lastError=false;
 const timeStore=browserStore(win);
 function read(){return root?timeStore.summary(root.dataset.readingOwner,root.dataset.bookId,dayKey(new Date())):null;}
 const clock=createReadingClock({now:()=>win.performance.now(),onTime:ms=>{
  if(!key||!stats||!root)return;
  try{stats=timeStore.add(root.dataset.readingOwner,root.dataset.bookId,ms,dayKey(new Date()));lastError=false;}catch{lastError=true;}
 }});
 function eligible(){
  if(!root||suspended||doc.visibilityState!=='visible'||root.classList.contains('reading-modal-open'))return false;
  if(root.querySelector('.sheet-scrim:not(.sheet-exiting),[role="dialog"],.reader-message,.book-loading'))return false;
  const flow=root.querySelector('.reading-content .page-viewport[data-ready="true"] .book-flow');
  if(flow&&flow.textContent.trim()&&win.getComputedStyle(flow).visibility!=='hidden')return true;
  for(const frame of root.querySelectorAll('.reading-content .epub-mount iframe'))try{if(frame.contentDocument?.body?.textContent.trim()&&frame.getBoundingClientRect().height>0)return true;}catch{}
  return false;
 }
 function paint(){
  const panel=root?.querySelector('.reading-bottom');if(!panel||!stats)return;
  let label=panel.querySelector('[data-libra-reading-time]');
  if(!label){label=doc.createElement('div');label.dataset.libraReadingTime='';label.style.cssText='display:flex;justify-content:center;gap:16px;padding:0 0 10px;font-size:11px;line-height:1.3;color:var(--muted);font-variant-numeric:tabular-nums';panel.prepend(label);}
  stats=read();const today=stats.today;
  const text=lastError?'Время чтения не сохранено: нет места на устройстве':`Сегодня в этой книге · ${formatReadingTime(today)}   По книге · ${formatReadingTime(stats.total)}${cloudStatus==='pending'?' · Облако: ожидает синхронизации':''}`;
  if(label.textContent!==text)label.textContent=text;
 }
 function update(){
  const next=doc.querySelector('.reading-root[data-book-id][data-reading-owner]');
  const nextKey=next?`libra-reading-time:v1:${encodeURIComponent(next.dataset.readingOwner)}:${encodeURIComponent(next.dataset.bookId)}`:null;
  if(root!==next||key!==nextKey){const previous=root;clock.setActive(false);root=next;key=nextKey;stats=key?read():null;if(previous)win.dispatchEvent(new win.Event('libra-reading-time-flush'));}
  clock.setActive(eligible());paint();paintLibraryReadingTime(win,doc);
 }
 // Visual planes are inert copies. Their per-frame transform changes do
 // not change whether the live book is readable and must not trigger style
 // resolution, localStorage reads or timer painting during a gesture.
 const visual='[data-libra-page-turn],[data-libra-preview-probe]';
 const observer=new win.MutationObserver(records=>{
  if(records.some(record=>!record.target.closest?.(visual)&&!(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].length&&[...record.addedNodes,...record.removedNodes].every(node=>node.nodeType===1&&node.matches?.(visual)))))update();
 });
 observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-ready','data-book-id','data-reading-owner','data-library-book','style']});
 const hide=()=>{suspended=true;clock.setActive(false);paint();win.dispatchEvent(new win.Event('libra-reading-time-flush'));};
 const show=()=>{suspended=false;update();};
 const visibility=()=>{if(doc.visibilityState==='visible')show();else hide();};
 const repaint=()=>{paint();paintLibraryReadingTime(win,doc);};
 win.addEventListener('libra-reading-time-change',repaint);
 doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',show);
 doc.addEventListener('freeze',hide);doc.addEventListener('resume',show);
 const interval=win.setInterval(()=>{clock.flush();paint();paintLibraryReadingTime(win,doc);},1000);update();
 return ()=>{hide();win.clearInterval(interval);observer.disconnect();win.removeEventListener('libra-reading-time-change',repaint);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',show);doc.removeEventListener('freeze',hide);doc.removeEventListener('resume',show);};
}
if(typeof window!=='undefined'&&typeof document!=='undefined')attachReadingTime(window,document);
