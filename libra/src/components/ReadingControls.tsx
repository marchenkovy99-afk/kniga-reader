import { useEffect,useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';
import type { ReaderSettings, ReaderPosition, StoredBook, SavedQuote } from '../domain';
import type {QuoteCapture} from '../quoteSelection';
import { toggleBookmark, addQuote } from '../storage';
import { sameBookmark } from '../bookmarks';
import { fontStack,resetTypography,readingInk,maximumTextPreset,balancePageMargins } from '../readerSettings';

type Props={
  book:StoredBook; settings:ReaderSettings; onSettings:(s:ReaderSettings)=>void;
  onBack:()=>void; onNext:()=>void; onPrevious:()=>void;
  position:ReaderPosition; progress:number; caption:string;
  pageNumber?:number; totalPages?:number; onPage?:(page:number)=>void; chapterTitle?:string; conditionalPages?:boolean;
  chapters?:{title:string;page?:number}[]; currentChapter?:number; onChapter?:(index:number)=>void;
  quoteSelection?:()=>QuoteCapture|null;
  children:ReactNode; safeMode?:boolean; interactiveContent?:boolean; modalContentOpen?:boolean;
};
export function ReadingControls({book,settings,onSettings,onBack,onNext,onPrevious,position,progress,caption,chapters,currentChapter,onChapter,children,interactiveContent=false,safeMode=false,modalContentOpen=false,pageNumber,totalPages,onPage,chapterTitle,conditionalPages=false,quoteSelection}:Props){
 const [panels,setPanels]=useState(false);
 const [sheet,setSheet]=useState<'settings'|'chapters'|'position'|null>(null);
 const [bookmarks,setBookmarks]=useState<ReaderPosition[]>(book.bookmarks||[]);
 const [quoteMode,setQuoteMode]=useState(false);
 const [quoteCapture,setQuoteCapture]=useState<QuoteCapture|null>(null);
 const [quoteBusy,setQuoteBusy]=useState(false);
 const [quoteNotice,setQuoteNotice]=useState('');
 const [markBusy,setMarkBusy]=useState(false);
 const [markError,setMarkError]=useState('');
 const [jump,setJump]=useState('');
 const [seekDraft,setSeekDraft]=useState<number|null>(null);
 const previewPercent=seekDraft===null?progress:Math.round(seekDraft/Math.max(1,totalPages||1)*100);
 const commitSeek=(value:number)=>{onPage?.(value);setSeekDraft(null)};
 const closeButton=useRef<HTMLButtonElement>(null);
 const restoreFocus=useRef<HTMLElement|null>(null);
 const marked=bookmarks.some(saved=>sameBookmark(saved,position));
 const touch=useRef<{x:number;y:number}|null>(null);
 const ignoreClick=useRef(false);
 useEffect(()=>{setQuoteMode(false);setQuoteCapture(null)},[book.id]);
 useEffect(()=>{
  if(!quoteMode||!quoteSelection)return;
  const check=()=>{const next=quoteSelection();if(next)setQuoteCapture(next)};
  document.addEventListener('selectionchange',check);
  window.addEventListener('pointerup',check);
  window.addEventListener('keyup',check);
  window.addEventListener('libra-quote-selection',check);
  return ()=>{
   document.removeEventListener('selectionchange',check);
   window.removeEventListener('pointerup',check);
   window.removeEventListener('keyup',check);
   window.removeEventListener('libra-quote-selection',check);
  };
 },[quoteMode,quoteSelection]);
 const closeQuoteMode=()=>{setQuoteMode(false);setQuoteCapture(null);window.getSelection()?.removeAllRanges();
  try{(document.querySelector('.epub-mount iframe') as HTMLIFrameElement|null)?.contentWindow?.getSelection()?.removeAllRanges()}catch{}
 };
 async function saveQuote(){
  if(quoteBusy||!quoteCapture)return;
  setQuoteBusy(true);
  try{
   const quote:SavedQuote={id:crypto.randomUUID(),text:quoteCapture.text,position:quoteCapture.position,createdAt:Date.now()};
   await addQuote(book.id,quote);closeQuoteMode();setQuoteNotice('Цитата сохранена');
  }catch(e){setQuoteNotice('Не удалось сохранить цитату: '+String(e))}
  finally{setQuoteBusy(false)}
 }
 async function copyQuote(){
  if(!quoteCapture)return;
  try{await navigator.clipboard.writeText(quoteCapture.text);setQuoteNotice('Текст скопирован');closeQuoteMode()}
  catch{setQuoteNotice('Не удалось скопировать текст')}
 }
 const update=<K extends keyof ReaderSettings>(key:K,value:ReaderSettings[K])=>onSettings({...settings,[key]:value});
 useEffect(()=>{
  if(!sheet)return;
  restoreFocus.current=document.activeElement as HTMLElement;
  closeButton.current?.focus();
  return ()=>restoreFocus.current?.focus();
 },[sheet]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement;
   if(event.key==='Escape'){setSheet(null);setPanels(false);closeQuoteMode();return;}
   if(sheet||modalContentOpen||target.closest('input,select,button,textarea'))return;
   if(safeMode&&(event.key==='PageDown'||event.key==='PageUp'))return;
   if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();onNext();}
   if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();onPrevious();}
  };
  window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
 },[sheet,safeMode,modalContentOpen,onNext,onPrevious]);
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
 return <div className={"reading-root "+(interactiveContent?"reading-interactive":"")+(modalContentOpen?" reading-modal-open":"")+(safeMode?" reading-scroll-safe":"")+(quoteMode?" reading-quote-mode":"")}>
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
   <button className="reading-status" aria-label="Показать управление чтением" aria-expanded={panels} onClick={()=>setPanels(v=>!v)} disabled={modalContentOpen}>
    <span>{pageNumber&&totalPages?`${pageNumber} / ${totalPages}`:caption}</span><span>{progress}%</span>
    <i aria-hidden="true"><i style={{width:progress+'%'}}/></i>
   </button>
   <header className={'reading-top '+(panels?'visible':'')}>
     <button aria-label="В библиотеку" onClick={onBack}><Icon name="back"/></button>
     <span className="reading-title">{book.title}</span>
     <button aria-label="Закладка" aria-pressed={marked} disabled={markBusy} onClick={()=>void mark()}><Icon name="bookmark" fill={marked?'currentColor':'none'}/></button>
     <button type="button" className="reading-panels-close" aria-label="Скрыть управление чтением" title="Скрыть управление чтением" onClick={()=>setPanels(false)}><Icon name="close"/></button>
   </header>
   {markError&&<div className="bookmark-error" role="alert">{markError}</div>}
   {quoteNotice&&<div className="quote-notice" role="status">{quoteNotice}<button aria-label="Закрыть уведомление" onClick={()=>setQuoteNotice('')}>×</button></div>}
   {quoteMode&&<div className="quote-mode-tip"><span>Выделите фрагмент текста</span><button type="button" onClick={closeQuoteMode}>Готово</button></div>}
   {quoteMode&&quoteCapture&&<div className="quote-popover" role="group" aria-label="Действия с выделенной цитатой" style={{left:Math.min(Math.max(14,(quoteCapture.rect.left+quoteCapture.rect.right)/2-116),Math.max(14,window.innerWidth-246)),top:Math.min(Math.max(65,quoteCapture.rect.top-66),Math.max(65,window.innerHeight-110))}} onPointerDown={e=>e.preventDefault()}>
     <button type="button" onClick={()=>void saveQuote()} disabled={quoteBusy}>Сохранить цитату</button>
     <button type="button" onClick={()=>void copyQuote()}>Копировать</button>
   </div>}
   <div className={'reading-bottom '+(panels?'visible':'')}>
     {chapterTitle&&<div className="reading-chapter">{chapterTitle}</div>}
     <div className="reading-progress"><span>{caption}</span><strong>{previewPercent}%</strong></div>
     <input className="reading-seek" type="range" aria-label="Прогресс чтения" aria-valuetext={'Страница '+(seekDraft??pageNumber??1)+' из '+(totalPages||1)+', '+previewPercent+'% прочитано'} min="1" max={totalPages||1} step="1"
      value={seekDraft??pageNumber??1} disabled={!onPage||!totalPages}
      onChange={e=>setSeekDraft(Number(e.target.value))}
      onPointerUp={e=>{commitSeek(Number(e.currentTarget.value))}}
      onKeyUp={e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){commitSeek(Number(e.currentTarget.value))}}}
      onBlur={e=>{if(seekDraft!==null){commitSeek(Number(e.currentTarget.value))}}}/>
     {(!onPage||!totalPages)&&<small className="indexing-note">Считаем страницы… Читать уже можно.</small>}
     <nav className="reading-tools">
       <button onClick={()=>setSheet('chapters')} disabled={!chapters}><Icon name="list"/>Оглавление</button>
       <button onClick={()=>setSheet('settings')}><Icon name="type"/>Текст</button>
       <button disabled={!totalPages||!onPage} onClick={()=>{setJump(String(pageNumber||1));setSheet('position')}}><Icon name="book"/>Страница</button>
        <button type="button" aria-pressed={quoteMode} onClick={()=>{setPanels(false);setSheet(null);setQuoteCapture(null);setQuoteMode(true)}}><Icon name="quote"/>Цитата</button>
     </nav>
   </div>
   {sheet&&<div className="sheet-scrim" onClick={()=>setSheet(null)}>
      <div className="reading-sheet" role="dialog" aria-modal="true" aria-label={sheet==='settings'?'Настройки чтения':sheet==='chapters'?'Оглавление':'Перейти на страницу'} onClick={e=>e.stopPropagation()}
       onKeyDown={e=>{
        if(e.key!=='Tab')return;
        const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,a[href]'));
        const first=controls[0],last=controls[controls.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
       }}>
       <div className="sheet-heading"><strong>{sheet==='settings'?'Настройки чтения':sheet==='chapters'?'Оглавление':'Перейти на страницу'}</strong><button ref={closeButton} aria-label="Закрыть" onClick={()=>setSheet(null)}><Icon name="close"/></button></div>
       {sheet==='position'?<form className="page-jump" onSubmit={e=>{e.preventDefault();const value=Number(jump);if(Number.isFinite(value)&&value>=1&&value<=(totalPages||1)){onPage?.(value);setSheet(null);setPanels(false)}}}>
         <label htmlFor="page-number">Страница от 1 до {totalPages}</label>
         <input id="page-number" type="number" inputMode="numeric" min="1" max={totalPages} step="1" required value={jump} onChange={e=>setJump(e.target.value)}/>
         {conditionalPages&&<p>В EPUB используются условные страницы по объёму текста. Они сохраняют номер при изменении шрифта.</p>}
         <button type="submit">Перейти</button>
       </form>:sheet==='chapters'?<div className="chapter-menu">{chapters?.map((c,i)=><button className={currentChapter===i?'active':''} key={i} onClick={()=>{onChapter?.(i);setSheet(null);setPanels(false)}}><span className="chapter-label">{c.title}</span><span className="chapter-page" aria-label={c.page!==undefined?'Страница '+c.page:'Номер страницы рассчитывается'}>{c.page!==undefined?c.page:'…'}</span></button>)}</div>:
       <div className="sheet-settings">
         <div className="reading-presets" aria-label="Готовые настройки текста">
          <button onClick={()=>onSettings({...settings,fontSize:18,lineHeight:1.3,margin:12,marginRight:12,verticalMargin:4,bottomMargin:0,paragraphSpacing:0,wordSpacing:0,letterSpacing:0})}>Компактно</button>
          <button type="button" onClick={()=>onSettings(maximumTextPreset(settings))}>Максимум текста</button>
          <button onClick={()=>onSettings(resetTypography(settings))}>Обычно</button>
          <button onClick={()=>onSettings({...settings,fontSize:24,lineHeight:1.5,margin:20,marginRight:20,verticalMargin:8,bottomMargin:4})}>Крупно</button>
         </div>
         <div className="type-preview" aria-label="Предпросмотр типографики" style={{
          fontFamily:fontStack(settings.fontFamily),fontSize:Math.min(settings.fontSize,27),
          fontWeight:settings.fontWeight,lineHeight:settings.lineHeight,
          wordSpacing:settings.wordSpacing,letterSpacing:settings.letterSpacing,
          hyphens:settings.hyphenation,textAlign:'left',color:readingInk(settings)
         }}>За окном медленно гас день. В комнате было тихо, и можно было наконец открыть книгу.</div>
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
         <label>Поле слева <strong>{settings.margin} px</strong><input type="range" min="0" max="52" step="2" value={settings.margin} onChange={e=>update('margin',Number(e.target.value))}/></label>
         <label>Между словами <strong>{settings.wordSpacing.toFixed(1)} px</strong><input type="range" min="0" max="5" step=".5" value={settings.wordSpacing} onChange={e=>update('wordSpacing',Number(e.target.value))}/></label>
         <label>Между буквами <strong>{settings.letterSpacing.toFixed(1)} px</strong><input type="range" min="-.5" max="1.5" step=".1" value={settings.letterSpacing} onChange={e=>update('letterSpacing',Number(e.target.value))}/></label>
         <div className="settings-section-title">Абзацы и страница</div>
         <label>Красная строка <strong>{settings.paragraphIndent.toFixed(1)} em</strong><input type="range" min="0" max="2.5" step=".1" value={settings.paragraphIndent} onChange={e=>update('paragraphIndent',Number(e.target.value))}/></label>
         <label>Между абзацами <strong>{settings.paragraphSpacing} px</strong><input type="range" min="0" max="24" step="1" value={settings.paragraphSpacing} onChange={e=>update('paragraphSpacing',Number(e.target.value))}/></label>
         <label>Поле сверху <strong>{settings.verticalMargin} px</strong><input type="range" min="0" max="52" step="2" value={settings.verticalMargin} onChange={e=>update('verticalMargin',Number(e.target.value))}/></label>
         <label>Поле справа <strong>{settings.marginRight} px</strong><input type="range" min="0" max="52" step="2" value={settings.marginRight} onChange={e=>update('marginRight',Number(e.target.value))}/></label>
         <label>Поле снизу <strong>{settings.bottomMargin} px</strong><input type="range" min="0" max="52" step="2" value={settings.bottomMargin} onChange={e=>update('bottomMargin',Number(e.target.value))}/></label>
         <label>Насыщенность текста <strong>{settings.fontWeight}</strong><input type="range" min="400" max="600" step="100" value={settings.fontWeight} onChange={e=>update('fontWeight',Number(e.target.value))}/></label>
         <div className="setting-row"><span>Поля без перекосов</span><button type="button" onClick={()=>onSettings(balancePageMargins(settings))}>Уравнять поля</button></div>
         <div className="setting-row"><span>Перенос слов</span><button type="button" aria-label="Перенос слов" onClick={()=>update('hyphenation',settings.hyphenation==='auto'?'none':'auto')}>{settings.hyphenation==='auto'?'Автоматический':'Выключен'}</button></div>
         <div className="settings-hint">Равные пробелы между словами. Поля и интервалы применяются ко всей книге.</div>
         <button type="button" className="typography-reset" onClick={()=>onSettings(resetTypography(settings))}>Сбросить настройки текста</button>
         <div className="theme-options">{(['paper','white','night','oled'] as const).map(name=><button key={name} className={'theme-swatch '+(settings.theme===name?'chosen':'')} data-option={name} title={name} onClick={()=>update('theme',name)}><span>{name==='paper'?'Бумага':name==='white'?'Белая':name==='night'?'Ночь':'OLED'}</span></button>)}</div>
         
         {(settings.theme==='night'||settings.theme==='oled')&&<label>Яркость текста <strong>{settings.textContrast}%</strong><input aria-label="Яркость текста" type="range" min="60" max="100" step="2" value={settings.textContrast} onChange={e=>update('textContrast',Number(e.target.value))}/></label>}
         <div className="setting-row"><span>Перелистывание</span><button onClick={()=>update('animation',settings.animation==='none'?'slide':'none')}>{settings.animation==='slide'?'Плавное':'Мгновенное'}</button></div>
       </div>}
      </div>
   </div>}
 </div>;
}
