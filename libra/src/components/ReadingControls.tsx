import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';
import type { ReaderSettings, ReaderPosition, StoredBook } from '../domain';
import { toggleBookmark } from '../storage';
import { sameBookmark } from '../bookmarks';
import { fontStack,resetTypography } from '../readerSettings';

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
 const [bookmarks,setBookmarks]=useState<ReaderPosition[]>(book.bookmarks||[]);
 const [markBusy,setMarkBusy]=useState(false);
 const [markError,setMarkError]=useState('');
 const marked=bookmarks.some(saved=>sameBookmark(saved,position));
 const touch=useRef<{x:number;y:number}|null>(null);
 const ignoreClick=useRef(false);
 const update=<K extends keyof ReaderSettings>(key:K,value:ReaderSettings[K])=>onSettings({...settings,[key]:value});
 function onTap(x:number, left:number, width:number){
   if(sheet){setSheet(null);return;}
   const ratio=(x-left)/Math.max(1,width);
   if(ratio<.28)onPrevious();else if(ratio>.72)onNext();else setPanels(v=>!v);
 }
 async function mark(){
   if(markBusy)return;
   setMarkBusy(true);setMarkError('');
   try{
    const updated=await toggleBookmark(book.id,position);
    setBookmarks(updated);
   }catch{
    setMarkError('Не удалось сохранить закладку');
   }finally{setMarkBusy(false)}
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
     onClick={e=>{if(ignoreClick.current)return;const box=e.currentTarget.getBoundingClientRect();onTap(e.clientX,box.left,box.width)}} />
   <header className={'reading-top '+(panels?'visible':'')}>
     <button aria-label="В библиотеку" onClick={onBack}><Icon name="back"/></button>
     <span className="reading-title">{book.title}</span>
     <button aria-label="Закладка" aria-pressed={marked} disabled={markBusy} onClick={()=>void mark()}><Icon name="bookmark" fill={marked?'currentColor':'none'}/></button>
   </header>
   {markError&&<div className="bookmark-error" role="alert">{markError}</div>}
   <div className={'reading-bottom '+(panels?'visible':'')}>
     <div className="reading-progress"><span>{caption}</span><strong>{progress}%</strong></div>
     <div className="reading-progress-track"><span style={{width:progress+'%'}} /></div>
     <nav className="reading-tools">
       <button onClick={()=>setSheet('chapters')} disabled={!chapters}><Icon name="list"/>Оглавление</button>
       <button onClick={()=>setSheet('settings')}><Icon name="type"/>Текст</button>
     </nav>
   </div>
   {sheet&&<div className="sheet-scrim" onClick={()=>setSheet(null)}>
      <div className="reading-sheet" onClick={e=>e.stopPropagation()}>
       <div className="sheet-heading"><strong>{sheet==='settings'?'Настройки чтения':'Оглавление'}</strong><button aria-label="Закрыть" onClick={()=>setSheet(null)}><Icon name="close"/></button></div>
       {sheet==='chapters'?<div className="chapter-menu">{chapters?.map((c,i)=><button className={currentChapter===i?'active':''} key={i} onClick={()=>{onChapter?.(i);setSheet(null);setPanels(false)}}>{c.title}</button>)}</div>:
       <div className="sheet-settings">
         <div className="settings-section-title">Как будет выглядеть текст</div>
         <div className="type-preview" aria-label="Предпросмотр типографики" style={{
          fontFamily:fontStack(settings.fontFamily),fontSize:Math.min(settings.fontSize,27),
          fontWeight:settings.fontWeight,lineHeight:settings.lineHeight,
          wordSpacing:settings.wordSpacing,letterSpacing:settings.letterSpacing,
          hyphens:settings.hyphenation,textAlign:'left'
         }}>Правильно подобранные интервалы помогают читать свободно, не растягивая пробелы.</div>
         <div className="settings-section-title">Шрифт</div>
         <div className="font-buttons font-choices">
           {([
            {id:'serif',name:'Georgia',sample:'Aa'},
            {id:'book',name:'Книжный',sample:'Аа'},
            {id:'sans',name:'Системный',sample:'Aa'},
            {id:'screen',name:'Verdana',sample:'Aa'}
           ] as const).map(item=>
             <button type="button" key={item.id} className={settings.fontFamily===item.id?'selected':''}
               onClick={()=>update('fontFamily',item.id)} aria-pressed={settings.fontFamily===item.id}>
               <span>{item.sample}</span><small>{item.name}</small>
             </button>
           )}
         </div>
         <div className="settings-section-title">Размер и интервалы</div>
         <label>Размер текста <strong>{settings.fontSize} px</strong><input type="range" min="12" max="36" step="1" value={settings.fontSize} onChange={e=>update('fontSize',Number(e.target.value))}/></label>
         <label>Интервал строк <strong>{settings.lineHeight.toFixed(2)}</strong><input type="range" min="1.1" max="2.2" step=".05" value={settings.lineHeight} onChange={e=>update('lineHeight',Number(e.target.value))}/></label>
         <label>Поле слева <strong>{settings.margin} px</strong><input type="range" min="6" max="52" step="2" value={settings.margin} onChange={e=>update('margin',Number(e.target.value))}/></label>
         <label>Между словами <strong>{settings.wordSpacing.toFixed(1)} px</strong><input type="range" min="0" max="5" step=".5" value={settings.wordSpacing} onChange={e=>update('wordSpacing',Number(e.target.value))}/></label>
         <label>Между буквами <strong>{settings.letterSpacing.toFixed(1)} px</strong><input type="range" min="-.5" max="1.5" step=".1" value={settings.letterSpacing} onChange={e=>update('letterSpacing',Number(e.target.value))}/></label>
         <div className="settings-section-title">Абзацы и страница</div>
         <label>Красная строка <strong>{settings.paragraphIndent.toFixed(1)} em</strong><input type="range" min="0" max="2.5" step=".1" value={settings.paragraphIndent} onChange={e=>update('paragraphIndent',Number(e.target.value))}/></label>
         <label>Между абзацами <strong>{settings.paragraphSpacing} px</strong><input type="range" min="0" max="24" step="1" value={settings.paragraphSpacing} onChange={e=>update('paragraphSpacing',Number(e.target.value))}/></label>
         <label>Поле сверху <strong>{settings.verticalMargin} px</strong><input type="range" min="0" max="52" step="2" value={settings.verticalMargin} onChange={e=>update('verticalMargin',Number(e.target.value))}/></label>
         <label>Поле справа <strong>{settings.marginRight} px</strong><input type="range" min="6" max="52" step="2" value={settings.marginRight} onChange={e=>update('marginRight',Number(e.target.value))}/></label>
         <label>Поле снизу <strong>{settings.bottomMargin} px</strong><input type="range" min="0" max="52" step="2" value={settings.bottomMargin} onChange={e=>update('bottomMargin',Number(e.target.value))}/></label>
         <label>Насыщенность текста <strong>{settings.fontWeight}</strong><input type="range" min="400" max="600" step="100" value={settings.fontWeight} onChange={e=>update('fontWeight',Number(e.target.value))}/></label>
         <div className="setting-row"><span>Перенос слов</span><button type="button" aria-label="Перенос слов" onClick={()=>update('hyphenation',settings.hyphenation==='auto'?'none':'auto')}>{settings.hyphenation==='auto'?'Автоматический':'Выключен'}</button></div>
         <div className="settings-hint">Межсловные интервалы остаются одинаковыми. Слова не растягиваются до правого края.</div>
         <button type="button" className="typography-reset" onClick={()=>onSettings(resetTypography(settings))}>Сбросить настройки текста</button>
         <div className="theme-options">{(['paper','white','night','oled'] as const).map(name=><button key={name} className={'theme-swatch '+(settings.theme===name?'chosen':'')} data-option={name} title={name} onClick={()=>update('theme',name)}><span>{name==='paper'?'Бумага':name==='white'?'Белая':name==='night'?'Ночь':'OLED'}</span></button>)}</div>
         
         <div className="setting-row"><span>Перелистывание</span><button onClick={()=>update('animation',settings.animation==='none'?'slide':'none')}>{settings.animation==='slide'?'Плавное':'Мгновенное'}</button></div>
       </div>}
      </div>
   </div>}
 </div>;
}
