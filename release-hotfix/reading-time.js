// A short heartbeat bounds time lost to abrupt iOS suspension; no background catch-up.
export function createReadingClock({now=()=>performance.now(),onTime}){
 let active=false,last=now();
 function flush(){const next=now(),elapsed=next-last;last=next;if(active&&elapsed>0&&elapsed<=5000)onTime(elapsed);}
 return {flush,setActive(value){const next=Boolean(value);if(next===active)return;flush();active=next;}};
}
export function formatReadingTime(ms){
 const seconds=Math.floor(Math.max(0,Number(ms)||0)/1000),minutes=Math.floor(seconds/60);
 return minutes>=60?`${Math.floor(minutes/60)} ч ${minutes%60} мин`:minutes?`${minutes} мин`:`${seconds} сек`;
}
const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function attachReadingTime(win,doc){
 let root=null,key=null,stats=null,suspended=false,lastError=false;
 const storage=win.localStorage;
 function read(){try{const value=JSON.parse(storage.getItem(key)||'null');return value&&value.version===1&&Number.isFinite(value.total)&&value.total>=0?{version:1,total:value.total,day:typeof value.day==='string'?value.day:'',today:Number.isFinite(value.today)&&value.today>=0?value.today:0}:{version:1,total:0,day:'',today:0};}catch{return {version:1,total:0,day:'',today:0};}}
 const clock=createReadingClock({now:()=>win.performance.now(),onTime:ms=>{
  if(!key||!stats)return;
  // Re-read so another window's already saved increments are preserved.
  stats=read();const day=dayKey(new Date());
  stats.total+=ms;stats.today=(stats.day===day?stats.today:0)+ms;stats.day=day;
  try{storage.setItem(key,JSON.stringify(stats));lastError=false;}catch{lastError=true;}
 }});
 function eligible(){
  if(!root||suspended||doc.visibilityState!=='visible'||root.classList.contains('reading-modal-open'))return false;
  if(root.querySelector('.sheet-scrim:not(.sheet-exiting),[role="dialog"],.reader-message,.book-loading'))return false;
  const flow=root.querySelector('.page-viewport[data-ready="true"] .book-flow');
  if(flow&&flow.textContent.trim()&&win.getComputedStyle(flow).visibility!=='hidden')return true;
  for(const frame of root.querySelectorAll('.epub-mount iframe'))try{if(frame.contentDocument?.body?.textContent.trim()&&frame.getBoundingClientRect().height>0)return true;}catch{}
  return false;
 }
 function paint(){
  const panel=root?.querySelector('.reading-bottom');if(!panel||!stats)return;
  let label=panel.querySelector('[data-libra-reading-time]');
  if(!label){label=doc.createElement('div');label.dataset.libraReadingTime='';label.style.cssText='display:flex;justify-content:center;gap:16px;padding:0 0 10px;font-size:11px;line-height:1.3;color:var(--muted);font-variant-numeric:tabular-nums';panel.prepend(label);}
  const today=stats.day===dayKey(new Date())?stats.today:0;
  const text=lastError?'Время чтения не сохранено: нет места на устройстве':`Сегодня в этой книге · ${formatReadingTime(today)}   Всего · ${formatReadingTime(stats.total)}`;
  if(label.textContent!==text)label.textContent=text;
 }
 function update(){
  const next=doc.querySelector('.reading-root[data-book-id][data-reading-owner]');
  const nextKey=next?`libra-reading-time:v1:${encodeURIComponent(next.dataset.readingOwner)}:${encodeURIComponent(next.dataset.bookId)}`:null;
  if(root!==next||key!==nextKey){clock.setActive(false);root=next;key=nextKey;stats=key?read():null;}
  clock.setActive(eligible());paint();
 }
 const observer=new win.MutationObserver(update);
 observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-ready','data-book-id','data-reading-owner','style']});
 const hide=()=>{suspended=true;clock.setActive(false);paint();};
 const show=()=>{suspended=false;update();};
 const visibility=()=>{if(doc.visibilityState==='visible')show();else hide();};
 doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',show);
 doc.addEventListener('freeze',hide);doc.addEventListener('resume',show);
 const interval=win.setInterval(()=>{clock.flush();update();},1000);update();
 return ()=>{hide();win.clearInterval(interval);observer.disconnect();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',show);doc.removeEventListener('freeze',hide);doc.removeEventListener('resume',show);};
}
if(typeof window!=='undefined'&&typeof document!=='undefined')attachReadingTime(window,document);
