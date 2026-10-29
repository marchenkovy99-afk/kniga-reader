import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';
import type { ReaderSettings, ReaderPosition, StoredBook } from '../domain';
import { toggleBookmark } from '../storage';

type Props={
  book:StoredBook; settings:ReaderSettings; onSettings:(s:ReaderSettings)=>void;
  onBack:()=>void; onNext:()=>void; onPrevious:()=>void;
  position:ReaderPosition; progress:number; caption:string;
  chapters?:{title:string}[]; currentChapter?:number; onChapter?:(index:number)=>void;
  children:ReactNode; interactiveContent?:boolean;
};
export function ReadingControls({book,settings,onSettings,onBack,onNext,onPrevious,position,progress,caption,chapters,currentChapter,onChapter,children,interactiveContent=false}:Props){
 const [panels,setPanels]=useState(false);
 const [sheet,setSheet]=useState<'settings'|'chapters'|null>(null);
 const [marked,setMarked]=useState(false);
 const touch=useRef<{x:number;y:number}|null>(null);
 const ignoreClick=useRef(false);
 const update=<K extends keyof ReaderSettings>(key:K,value:ReaderSettings[K])=>onSettings({...settings,[key]:value});
 function onTap(x:number){
   if(sheet){setSheet(null);return;}
   const ratio=x/window.innerWidth;
   if(ratio<.28)onPrevious();else if(ratio>.72)onNext();else setPanels(v=>!v);
 }
 async function mark(){
   await toggleBookmark(book.id,position);setMarked(v=>!v);
 }
 return <div className={"reading-root "+(interactiveContent?"reading-interactive":"")}>
   <div className="reading-content">{children}</div>
   <div className="reading-zones" role="presentation"
     onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
     onTouchEnd={e=>{
       if(!touch.current)return;
       const dx=e.changedTouches[0].clientX-touch.current.x;
       const dy=e.changedTouches[0].clientY-touch.current.y;
       touch.current=null;
       if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3){
         ignoreClick.current=true;
         if(dx<0)onNext();else onPrevious();
         window.setTimeout(()=>{ignoreClick.current=false},350);
       }
     }}
     onClick={e=>{if(ignoreClick.current)return;onTap(e.clientX)}} />
   <header className={'reading-top '+(panels?'visible':'')}>
     <button aria-label="В библиотеку" onClick={onBack}><Icon name="back"/></button>
     <span className="reading-title">{book.title}</span>
     <button aria-label="Закладка" onClick={()=>void mark()}><Icon name="bookmark" fill={marked?'currentColor':'none'}/></button>
   </header>
   <div className={'reading-bottom '+(panels?'visible':'')}>
     <div className="reading-progress"><span>{caption}</span><strong>{progress}%</strong></div>
     <div className="reading-progress-track"><span style={{width:progress+'%'}} /></div>
     <nav className="reading-tools">
       <button onClick={()=>setSheet('chapters')} disabled={!chapters}><Icon name="list"/>Оглавление</button>
       <button onClick={()=>setSheet('settings')}><Icon name="type"/>Текст</button>
       <button onClick={()=>{setSheet('settings')}}><Icon name="settings"/>Настройки</button>
     </nav>
   </div>
   {sheet&&<div className="sheet-scrim" onClick={()=>setSheet(null)}>
      <div className="reading-sheet" onClick={e=>e.stopPropagation()}>
       <div className="sheet-heading"><strong>{sheet==='settings'?'Настройки чтения':'Оглавление'}</strong><button aria-label="Закрыть" onClick={()=>setSheet(null)}><Icon name="close"/></button></div>
       {sheet==='chapters'?<div className="chapter-menu">{chapters?.map((c,i)=><button className={currentChapter===i?'active':''} key={i} onClick={()=>{onChapter?.(i);setSheet(null);setPanels(false)}}>{c.title}</button>)}</div>:
       <div className="sheet-settings">
         <div className="font-buttons"><button className={settings.fontFamily==='serif'?'selected':''} onClick={()=>update('fontFamily','serif')}>Aa <small>С засечками</small></button><button className={settings.fontFamily==='sans'?'selected':''} onClick={()=>update('fontFamily','sans')}>Aa <small>Без засечек</small></button></div>
         <label>Размер текста <strong>{settings.fontSize} px</strong><input type="range" min="14" max="28" step="1" value={settings.fontSize} onChange={e=>update('fontSize',Number(e.target.value))}/></label>
         <label>Интервал строк <strong>{settings.lineHeight.toFixed(2)}</strong><input type="range" min="1.15" max="1.85" step=".05" value={settings.lineHeight} onChange={e=>update('lineHeight',Number(e.target.value))}/></label>
         <label>Поля <strong>{settings.margin} px</strong><input type="range" min="12" max="36" step="2" value={settings.margin} onChange={e=>update('margin',Number(e.target.value))}/></label>
         <div className="theme-options">{(['paper','white','night','oled'] as const).map(name=><button key={name} className={'theme-swatch '+(settings.theme===name?'chosen':'')} data-option={name} title={name} onClick={()=>update('theme',name)}><span>{name==='paper'?'Бумага':name==='white'?'Белая':name==='night'?'Ночь':'OLED'}</span></button>)}</div>
         <div className="setting-row"><span>Выравнивание</span><button onClick={()=>update('align',settings.align==='justify'?'left':'justify')}>{settings.align==='justify'?'По ширине':'По левому краю'}</button></div>
         <div className="setting-row"><span>Перелистывание</span><button onClick={()=>update('animation',settings.animation==='none'?'slide':'none')}>{settings.animation==='slide'?'Плавное':'Мгновенное'}</button></div>
       </div>}
      </div>
   </div>}
 </div>;
}
