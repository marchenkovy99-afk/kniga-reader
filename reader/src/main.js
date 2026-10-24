import {PageFlip} from 'page-flip';
import {importBook,escapeHTML as esc} from './importer.js';
import {defaults,clampSettings,pageForAnchor} from './anchors.js';
import {paginate,applyTypography} from './pagination.js';
import * as storage from './storage.js';
import {CloudSync} from './cloud.js';
import {mergeMarks} from './sync-model.js';
import './style.css';
import {sha256} from 'js-sha256';
const app=document.querySelector('#app');
const paths={book:'M4 4h6a4 4 0 0 1 4 4v13a5 5 0 0 0-5-3H4V4Zm16 0h-6a4 4 0 0 0-4 4v13a5 5 0 0 1 5-3h5V4Z',plus:'M12 5v14M5 12h14',back:'m14 5-7 7 7 7',next:'m10 5 7 7-7 7',bookmark:'M6 3h12v18l-6-4-6 4V3Z',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',list:'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',close:'m6 6 12 12M6 18 18 6',sun:'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4m-12.8 0L7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',more:'M5 12h.01M12 12h.01M19 12h.01',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',check:'m5 12 4 4 10-10',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const button=(name,label,id,extra='')=>`<button class="icon-button" id="${id}" aria-label="${label}" title="${label}" ${extra}>${icon(name)}</button>`;
let books=[],settings={...defaults},current=null,pages=[],pageIndex=0,flip=null,abort=null,layoutTimer,saveTimer,anchor={block:0,offset:0},busy=false,settingsTab='text',resizeObserver,lastSize='',sheetReturn=null;
let cloud=null,settingsUpdatedAt=0;
const activeMarks=book=>(book.marks||[]).filter(m=>!m.deleted);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!settings.animation;
function message(text,error=false){let box=document.querySelector('#notification');if(!box){box=document.createElement('div');box.id='notification';box.setAttribute('role','status');document.body.append(box);}box.className=error?'notice error':'notice';box.textContent=text;box.hidden=false;clearTimeout(box.timer);box.timer=setTimeout(()=>box.hidden=true,error?10000:5000);}
function theme(){document.documentElement.dataset.theme=settings.theme;}
function fileInput(){return '<input id="file-input" type="file" accept=".fb2,.fb2.zip,.fbz,.zip,.epub,.txt" hidden multiple />';}
function ensureSheet(){if(!document.querySelector('#sheet')){const d=document.createElement('dialog');d.id='sheet';document.body.append(d);d.addEventListener('click',e=>{if(e.target===d)closeSheet();});d.addEventListener('close',()=>{sheetReturn?.focus();});}}
function openSheet(title,html,wide=false){ensureSheet();const d=document.querySelector('#sheet');sheetReturn=document.activeElement;d.className=wide?'sheet wide':'sheet';d.innerHTML=`<div class="handle"></div><header class="sheet-header"><h2>${title}</h2>${button('close','Закрыть','close-sheet')}</header><div class="sheet-content">${html}</div>`;d.querySelector('#close-sheet').onclick=closeSheet;if(!d.open)d.showModal();}
function closeSheet(){document.querySelector('#sheet')?.close();}
function dispose(){abort?.abort();clearTimeout(layoutTimer);resizeObserver?.disconnect();resizeObserver=null;if(flip){flip.destroy();flip=null;}pages=[];}
async function persistPosition(){if(!current)return;const id=current.id;const data={anchor:{...anchor},marks:current.marks||[],updatedAt:current.progress?.updatedAt||Date.now()};current.progress=data;try{await storage.setPreference(`position:${id}`,data);cloud?.queue(`position:${id}`,data,data.updatedAt);}catch(e){message(e.message,true);}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persistPosition,220);}
function progressFor(b){const a=b.progress?.anchor;if(!a)return 0;const before=b.blocks.slice(0,a.block).reduce((sum,x)=>sum+x.text.length,0)+a.offset;return Math.max(0,Math.min(100,Math.round(before/Math.max(1,b.chars)*100)));}
function cover(b,small=false){return `<div class="cover ${small?'small':''}" data-color="${b.id==='sample'?'green':'brown'}">${b.cover?`<img src="${b.cover}" alt="Обложка книги ${esc(b.title)}">`:`<div class="cover-author">${esc(b.author)}</div><div class="cover-title">${esc(b.title)}</div><div class="cover-rule"></div><span class="cover-format">${esc(b.format)}</span>`}</div>`;}
async function library(){
 await persistPosition();dispose();current=null;document.body.classList.remove('reading');theme();
 app.innerHTML=`<div class="library"><header class="library-top"><a class="brand" href="#" aria-label="Книга: библиотека">${icon('book')}<span>Книга<span class="brand-dot">.</span></span></a><button id="cloud-status" class="cloud-status" aria-label="Облачная синхронизация">Облако</button><button class="button primary import-button">${icon('plus')}<span>Добавить книгу</span></button></header><main><div class="library-heading"><div><p class="eyebrow">ВАШЕ МЕСТО ДЛЯ ЧТЕНИЯ</p><h1>Моя библиотека</h1></div><p class="library-note">Свои книги.<br>В своём ритме.</p></div><section id="continue-slot"></section><div class="shelf-top"><h2>На полке <span>${books.length}</span></h2><label class="library-search">${icon('search')}<input id="library-search" type="search" placeholder="Название или автор" aria-label="Найти книгу в библиотеке"></label></div><div id="book-grid" class="book-grid"></div><div class="import-strip"><div class="strip-icon">${icon('upload')}</div><div><strong>Принесите свою книгу</strong><p>FB2, FB2.zip, EPUB или TXT · до 20 МБ</p></div><button class="text-button import-button">Выбрать файл ${icon('next')}</button></div></main><footer class="library-footer"><span>На устройстве и в вашем личном облаке.</span><button id="about" class="text-button">О читалке</button></footer></div>${fileInput()}`;
 const last=[...books].filter(b=>b.progress?.updatedAt).sort((a,b)=>b.progress.updatedAt-a.progress.updatedAt)[0];
 if(last)document.querySelector('#continue-slot').innerHTML=`<article class="continue"><div class="continue-cover">${cover(last,true)}</div><div class="continue-copy"><span class="eyebrow">ПРОДОЛЖИТЬ ЧТЕНИЕ</span><h2>${esc(last.title)}</h2><p>${esc(last.author)}</p><div class="continue-bottom"><span>${progressFor(last)}% книги</span><button class="button primary" id="continue-book">Читать ${icon('next')}</button></div></div></article>`;
 document.querySelector('#cloud-status').onclick=showCloud;updateCloudStatus();
 document.querySelector('#continue-book')?.addEventListener('click',()=>openBook(last.id));
 renderGrid('');document.querySelector('#library-search').oninput=e=>renderGrid(e.target.value);
 document.querySelectorAll('.import-button').forEach(b=>b.onclick=()=>document.querySelector('#file-input').click());
 document.querySelector('#file-input').onchange=e=>handleFiles(e.target.files);
 document.querySelector('#about').onclick=()=>openSheet('О читалке',`<div class="prose"><p>Черновая версия для ваших FB2, FB2.zip, EPUB без DRM и TXT. Файл книги, настройки и место чтения сохраняются на этом устройстве. При включённом облаке они доступны и на других устройствах.</p><p>При очистке данных браузера библиотека удалится. Исходный файл можно скачать в меню книги. Облачная синхронизация доступна после входа через ChatGPT. Книги и прогресс привязаны к вашей учётной записи.</p><p>Формат PDF и EPUB с фиксированной вёрсткой пока не поддерживаются. Издательские стили EPUB заменяются настройками читалки.</p><p>Лимиты черновика: файл 20 МБ, распаковка 60 МБ, 2 млн символов. Неподдерживаемые файлы отклоняются целиком.</p></div>`);
}
function renderGrid(query){
 const found=books.filter(b=>(b.title+' '+b.author).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 document.querySelector('#book-grid').innerHTML=found.length?found.map(b=>`<article class="book-card"><button class="book-open" data-book="${b.id}" aria-label="Открыть книгу ${esc(b.title)}">${cover(b)}</button><div class="book-meta"><div><h3>${esc(b.title)}</h3><p>${esc(b.author)}</p><span>${b.id==='sample'?'Демонстрационный фрагмент':esc(b.format)+' · '+Math.ceil(b.chars/1000)+' тыс. знаков'}</span></div><button class="icon-button book-more" data-info="${b.id}" aria-label="О книге ${esc(b.title)}">${icon('more')}</button></div></article>`).join(''):'<div class="empty"><h3>Книга не найдена</h3><p>Попробуйте другое название или автора.</p></div>';
 document.querySelectorAll('[data-book]').forEach(x=>x.onclick=()=>openBook(x.dataset.book));document.querySelectorAll('[data-info]').forEach(x=>x.onclick=()=>bookInfo(books.find(b=>b.id===x.dataset.info)));
}
async function handleFiles(files){
 if(busy)return;busy=true;
 const input=document.querySelector('#file-input');
 for(const file of Array.from(files||[])){
  try{message(`Открываем «${file.name}»…`);const original=await file.arrayBuffer();const parsed=await importBook(original,file.name);
   const id=sha256(original);
   if(books.some(b=>b.id===id)){message('Эта книга уже есть в библиотеке.');continue;}
   const book={...parsed,id,original,fileName:file.name,addedAt:Date.now(),marks:[]};await storage.putBook(book);books.push(book);cloud?.sync();
   if(current)await library();else {await library();}
   message(book.warnings.length?'Книга добавлена. Проверьте замечания в меню «О книге».':'Книга добавлена в библиотеку.');
  }catch(e){message(e.message||'Не удалось открыть книгу. Проверьте формат файла.',true);}
 }
 if(input)input.value='';busy=false;
}
function downloadBook(b){const url=URL.createObjectURL(new Blob([b.original]));const a=document.createElement('a');a.href=url;a.download=b.fileName||'book.fb2';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bookInfo(b){
 openSheet('О книге',`<div class="prose"><h3>${esc(b.title)}</h3><p>${esc(b.author)}</p><dl><dt>Формат</dt><dd>${b.format}</dd><dt>Объём текста</dt><dd>${b.chars.toLocaleString('ru-RU')} знаков</dd><dt>Разделов в оглавлении</dt><dd>${b.chapters.length}</dd></dl>${b.warnings.length?'<h3>Замечания при импорте</h3>'+b.warnings.map(w=>`<p>${esc(w)}</p>`).join(''):''}<p class="muted">Настройки оформления не изменяют исходный файл.</p><button id="download-original" class="button secondary">${icon('download')} Скачать исходный файл</button><button id="remove-book" class="text-button danger">Убрать с полки</button></div>`);
 document.querySelector('#download-original').onclick=()=>downloadBook(b);
 document.querySelector('#remove-book').onclick=async()=>{
  closeSheet();openSheet('Убрать книгу с полки?',`<div class="prose"><p>«${esc(b.title)}» исчезнет с этого устройства. Исходный файл и облачная копия останутся.</p><div class="action-row"><button class="button secondary" id="keep-book">Оставить</button><button class="button primary" id="confirm-remove">Убрать с полки</button></div></div>`);
  document.querySelector('#keep-book').onclick=closeSheet;document.querySelector('#confirm-remove').onclick=async()=>{try{if(cloud?.owner){const hidden=await storage.getPreference(`cloud-hidden:${cloud.owner}`)||[];await storage.setPreference(`cloud-hidden:${cloud.owner}`,[...new Set([...hidden,b.id])]);}await storage.deleteBook(b.id);books=books.filter(x=>x.id!==b.id);closeSheet();await library();}catch(e){message(e.message,true);}};
 };
}
async function openBook(id){
 const b=books.find(x=>x.id===id);if(!b)return;
 if(current)await persistPosition();dispose();current=b;
 try{const stored=await storage.getPreference(`position:${id}`);if(stored){b.progress=stored;b.marks=stored.marks||[];}}catch(e){message(e.message,true);}
 anchor=b.progress?.anchor||{block:0,offset:0};pageIndex=0;
 document.body.classList.add('reading');theme();
 app.innerHTML=`<div class="reader ${reduced()?'':'reader-enter'}"><header class="reader-header">${button('back','В библиотеку','to-library')}<div class="reader-heading"><span>${esc(b.title)}</span><small>${esc(b.author)}</small></div>${button('bookmark','Поставить закладку','toggle-bookmark','aria-pressed="false"')}</header><main id="book-stage" class="book-stage" aria-label="Страницы книги"><div id="page-loading" class="page-loading" role="status">Готовим страницы…</div></main><footer class="reader-footer"><div class="page-status"><span id="reading-percent">0% книги</span><span id="page-count"></span></div><input id="reading-progress" class="reading-progress" type="range" min="0" max="1" value="0" step="1" aria-label="Перейти на страницу"><nav class="reader-tools" aria-label="Управление чтением">${button('list','Оглавление и закладки','contents')}${button('search','Поиск по книге','search-book')}<button class="icon-button type-button" id="appearance" aria-label="Оформление текста" title="Оформление текста">Aa</button>${button('sun','Сменить тему','cycle-theme')}<div class="nav-arrows">${button('back','Предыдущая страница','prev-page')}${button('next','Следующая страница','next-page')}</div></nav></footer></div>`;
 document.querySelector('#to-library').onclick=library;document.querySelector('#toggle-bookmark').onclick=toggleBookmark;
 document.querySelector('#contents').onclick=showContents;document.querySelector('#search-book').onclick=showSearch;
 document.querySelector('#appearance').onclick=showSettings;document.querySelector('#cycle-theme').onclick=()=>{settings.theme=['paper','white','night'][(['paper','white','night'].indexOf(settings.theme)+1)%3];theme();saveSettings();};
 document.querySelector('#prev-page').onclick=()=>turn(-1);document.querySelector('#next-page').onclick=()=>turn(1);
 document.querySelector('#reading-progress').onchange=e=>goPage(Number(e.target.value));
 await layout();
 resizeObserver=new ResizeObserver(()=>{const stage=document.querySelector('#book-stage');if(!stage)return;const key=`${Math.round(stage.clientWidth)}x${Math.round(stage.clientHeight)}`;if(key!==lastSize){clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>layout(),200);}});resizeObserver.observe(document.querySelector('#book-stage'));
}
async function layout(){
 if(!current)return;abort?.abort();const controller=new AbortController();abort=controller;
 const stage=document.querySelector('#book-stage');if(!stage)return;
 const width=Math.floor(stage.clientWidth),height=Math.floor(stage.clientHeight);if(width<100||height<80)return;
 lastSize=`${width}x${height}`;
 let loader=document.querySelector('#page-loading');if(!loader){loader=document.createElement('div');loader.id='page-loading';loader.className='page-loading';loader.setAttribute('role','status');stage.append(loader);}loader.textContent='Пересчитываем страницы…';
 const target={...anchor},snapshot={...settings};
 try{
  await document.fonts.ready;
  const result=await paginate(current.blocks,{width,height,settings:snapshot,signal:controller.signal,onProgress:p=>loader.textContent=`Готовим страницы · ${p}%`});
  if(controller.signal.aborted)return;
  if(flip){flip.destroy();flip=null;}
  stage.innerHTML='';pages=result;pageIndex=pageForAnchor(pages,target);
  const book=document.createElement('div');book.id='flipbook';book.setAttribute('aria-label','Книга с перелистыванием страниц');stage.append(book);
  const nodes=pages.map((p,i)=>{const node=document.createElement('section');node.className='book-page';node.setAttribute('data-density','soft');node.setAttribute('aria-label',`Страница ${i+1}`);node.innerHTML=`<div class="book-text" data-page="${i}">${p.html}</div>`;applyTypography(node.querySelector('.book-text'),snapshot,width);return node;});
  flip=new PageFlip(book,{width,height,size:'fixed',minWidth:100,maxWidth:2000,minHeight:80,maxHeight:3000,usePortrait:true,autoSize:false,startPage:pageIndex,drawShadow:true,maxShadowOpacity:0.24,flippingTime:550,showCover:false,mobileScrollSupport:true,clickEventForward:true,useMouseEvents:!reduced(),showPageCorners:!reduced(),disableFlipByClick:true,swipeDistance:35});
  let initializing=true;
  flip.on('flip',e=>{if(initializing)return;pageIndex=e.data;anchor={...pages[pageIndex].start};updateProgress();current.progress={...current.progress,updatedAt:Date.now()};scheduleSave();});
  flip.loadFromHTML(nodes);flip.turnToPage(pageIndex);initializing=false;
  book.addEventListener('click',e=>{const a=e.target.closest('[data-note]');if(a){e.preventDefault();showNote(a.dataset.note);}});
  anchor=target; // Keep the precise source anchor through consecutive typography edits.
  updateProgress();scheduleSave();
 }catch(e){if(e.name!=='AbortError'){loader.textContent=e.message;loader.classList.add('layout-error');message(e.message,true);}}
}
function updateProgress(){
 if(!current||!pages.length)return;
 const before=current.blocks.slice(0,anchor.block).reduce((sum,b)=>sum+b.text.length,0)+anchor.offset;
 const percent=Math.round(before/Math.max(1,current.chars)*100);
 document.querySelector('#reading-percent').textContent=`${Math.min(100,percent)}% книги`;
 document.querySelector('#page-count').textContent=`${pageIndex+1} / ${pages.length}`;
 const progress=document.querySelector('#reading-progress');progress.max=pages.length-1;progress.value=pageIndex;
 progress.setAttribute('aria-valuetext',`Страница ${pageIndex+1} из ${pages.length}`);
 document.querySelector('#prev-page').disabled=pageIndex===0;document.querySelector('#next-page').disabled=pageIndex>=pages.length-1;
 const marked=activeMarks(current).some(m=>pageForAnchor(pages,m.anchor)===pageIndex);
 document.querySelector('#toggle-bookmark').classList.toggle('marked',marked);document.querySelector('#toggle-bookmark').setAttribute('aria-pressed',String(marked));
 // Only the active page is exposed to assistive technology; physical page layers stay visual.
 document.querySelectorAll('.book-page').forEach((el,i)=>el.setAttribute('aria-hidden',String(i!==pageIndex)));
}
function turn(dir){if(!flip||!pages.length)return;if(flip.getState()!=='read')return;const next=pageIndex+dir;if(next<0||next>=pages.length)return;if(reduced()){goPage(next);return;}dir>0?flip.flipNext('bottom'):flip.flipPrev('bottom');}
function goPage(index){if(!flip||!pages.length)return;pageIndex=Math.max(0,Math.min(pages.length-1,index));flip.turnToPage(pageIndex);anchor={...pages[pageIndex].start};current.progress={...current.progress,updatedAt:Date.now()};updateProgress();scheduleSave();}
function jump(target){closeSheet();if(!pages.length)return;goPage(pageForAnchor(pages,target));anchor={...target};updateProgress();scheduleSave();}
function toggleBookmark(){
 if(!current||!pages.length)return;
 const marks=current.marks||[],existing=activeMarks(current).find(m=>pageForAnchor(pages,m.anchor)===pageIndex);
 const mark=existing?{...existing,deleted:true,changedAt:Date.now()}:{anchor:{...anchor},label:current.blocks[anchor.block]?.text.slice(anchor.offset,anchor.offset+90)||current.title,changedAt:Date.now(),deleted:false};
 current.marks=mergeMarks(marks,[mark]);current.progress={...current.progress,updatedAt:Date.now()};updateProgress();persistPosition();message(existing?'Закладка снята.':'Закладка сохранена.');
}
function showContents(){
 const marks=activeMarks(current);
 openSheet('Оглавление и закладки',`<div class="contents-list">${current.chapters.map(c=>`<button class="chapter-row" data-jump="${c.block}"><span>${esc(c.title)}</span>${icon('next')}</button>`).join('')}</div><h3 class="subheading">Закладки <span>${marks.length}</span></h3>${marks.length?marks.map((m,i)=>`<button class="chapter-row bookmark-row" data-mark="${i}">${icon('bookmark')}<span>${esc(m.label)}</span></button>`).join(''):'<p class="muted small-copy">Нажмите значок закладки над страницей, чтобы вернуться к этому месту.</p>'}`);
 document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump({block:Number(b.dataset.jump),offset:0}));document.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>jump(marks[Number(b.dataset.mark)].anchor));
}
function showSearch(){
 openSheet('Поиск по книге','<label class="search-field">'+icon('search')+'<input id="book-search" type="search" placeholder="Слово или фраза" aria-label="Найти в тексте книги"></label><div id="search-results" class="search-results"><p class="muted">Введите хотя бы два символа.</p></div>');
 const input=document.querySelector('#book-search');input.focus();let timer;
 input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{
  const q=input.value.toLocaleLowerCase('ru');const result=document.querySelector('#search-results');if(q.length<2){result.innerHTML='<p class="muted">Введите хотя бы два символа.</p>';return;}
  const matches=[];for(let i=0;i<current.blocks.length;i++){const t=current.blocks[i].text;let at=0;while((at=t.toLocaleLowerCase('ru').indexOf(q,at))!==-1){matches.push({block:i,offset:at,text:t.slice(Math.max(0,at-35),at+q.length+70)});at+=q.length;}}
  result.innerHTML=`<p class="muted">Совпадений: ${matches.length}${matches.length>50?' · показаны первые 50':''}</p>`+matches.slice(0,50).map((m,i)=>`<button class="search-result" data-result="${i}">${esc(m.text)}</button>`).join('');
  result.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>jump(matches[Number(b.dataset.result)]));
 },150);};
}
function showNote(id){
 const i=current.blocks.findIndex(b=>b.sourceId===id);if(i<0){message('Ссылка не найдена. Полный текст доступен в оглавлении.',true);return;}
 let end=i+1;while(end<current.blocks.length&&current.blocks[end].type!=='h2'&&!current.blocks[end].sourceId)end++;
 openSheet('Примечание',`<div class="note-text">${current.blocks.slice(i,end).map(b=>`<p>${b.html}</p>`).join('')}</div><button class="text-button" id="go-note">Перейти к этому месту ${icon('next')}</button>`);
 document.querySelector('#go-note').onclick=()=>jump({block:i,offset:0});
}
function saveSettings(){settingsUpdatedAt=Date.now();storage.setPreference('settings-updatedAt',settingsUpdatedAt).catch(e=>message(e.message,true));storage.setPreference('settings',settings).catch(e=>message(e.message,true));cloud?.queue('settings',settings,settingsUpdatedAt);}
const ranges={fontSize:['Размер текста',12,48,1,'px'],lineHeight:['Межстрочный интервал',1,2.5,.05,'×'],margin:['Боковые поля',8,72,1,'px'],paragraphGap:['Между абзацами',0,2,.1,'em'],indent:['Отступ первой строки',0,3,.1,'em'],letterSpacing:['Между буквами',-.5,3,.1,'px']};
function rangeControl(key){const [label,min,max,step,unit]=ranges[key];return `<div class="setting-control"><div class="setting-title"><label for="range-${key}">${label}</label><div class="exact-value"><input type="number" id="number-${key}" aria-label="${label}: точное значение" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><span>${unit}</span></div></div><div class="range-row"><button class="step-button" data-step="${key}:-1" aria-label="Уменьшить: ${label}">−</button><input id="range-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-setting="${key}"><button class="step-button" data-step="${key}:1" aria-label="Увеличить: ${label}">+</button></div></div>`;}
function showSettings(){
 const tabs=`<div class="segmented" role="tablist" aria-label="Раздел настроек"><button role="tab" data-tab="text" aria-selected="${settingsTab==='text'}">Текст</button><button role="tab" data-tab="page" aria-selected="${settingsTab==='page'}">Страница</button><button role="tab" data-tab="themes" aria-selected="${settingsTab==='themes'}">Темы</button></div>`;
 let html='';
 if(settingsTab==='text')html=`<label class="select-setting"><span>Шрифт</span><select id="font-select" aria-label="Шрифт"><option value="serif">Книжный</option><option value="literary">Классический</option><option value="sans">Без засечек</option></select></label>${rangeControl('fontSize')}${rangeControl('lineHeight')}<details class="advanced"><summary>Ещё настройки текста</summary>${rangeControl('paragraphGap')}${rangeControl('indent')}${rangeControl('letterSpacing')}<label class="select-setting"><span>Выравнивание</span><select id="align-select" aria-label="Выравнивание"><option value="left">По левому краю</option><option value="justify">По ширине</option></select></label><label class="switch-row"><span>Переносы слов</span><input type="checkbox" id="hyphens-check" ${settings.hyphens?'checked':''}></label></details>`;
 if(settingsTab==='page')html=`${rangeControl('margin')}<p class="small-copy muted">Поля применяются симметрично. На узком экране сохраняется место для читаемого текста.</p><label class="switch-row"><span>Переворот страницы</span><input type="checkbox" id="animation-check" ${settings.animation?'checked':''}></label><p class="small-copy muted">Изгиб страницы с тенью. При системном уменьшении движения используется мгновенный переход.</p><p class="small-copy muted">Чтобы листать, проведите по странице, потяните её за угол или используйте стрелки.</p>`;
 if(settingsTab==='themes')html=`<div class="theme-options">${[['paper','Бумага'],['white','Светлая'],['night','Ночная']].map(([key,label])=>`<button class="theme-option" data-theme-choice="${key}" aria-pressed="${settings.theme===key}"><span class="theme-sample ${key}">Aa</span><span>${label}</span>${settings.theme===key?icon('check'):''}</button>`).join('')}</div><p class="small-copy muted">Тема меняет фон страницы и интерфейса. Положение в книге сохраняется.</p>`;
 openSheet('Оформление',tabs+`<div class="settings-body">${html}</div><div class="settings-bottom"><span>Изменения видны сразу</span><button id="reset-settings" class="text-button">Сбросить</button></div>`);
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{settingsTab=b.dataset.tab;showSettings();});
 const change=(key,value)=>{settings=clampSettings({...settings,[key]:value});saveSettings();syncControls(key);clearTimeout(layoutTimer);layoutTimer=setTimeout(layout,180);};
 const syncControls=key=>{for(const prefix of ['range-','number-']){const el=document.getElementById(prefix+key);if(el&&!(el.type==='number'&&document.activeElement===el))el.value=settings[key];}};
 document.querySelectorAll('[data-setting]').forEach(e=>e.oninput=()=>change(e.dataset.setting,Number(e.value)));
 for(const key of Object.keys(ranges)){const input=document.getElementById('number-'+key);if(input){input.oninput=()=>{const n=Number(input.value);if(input.value!==''&&Number.isFinite(n)&&n>=ranges[key][1]&&n<=ranges[key][2])change(key,n);};input.onchange=()=>{change(key,input.value===''?defaults[key]:Number(input.value));input.value=settings[key];};}}
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const[key,d]=b.dataset.step.split(':');change(key,Math.round((settings[key]+Number(d)*ranges[key][3])*100)/100);});
 for(const [id,key] of [['font-select','font'],['align-select','align']]){const e=document.getElementById(id);if(e){e.value=settings[key];e.onchange=()=>change(key,e.value);}}
 for(const [id,key] of [['hyphens-check','hyphens'],['animation-check','animation']]){const e=document.getElementById(id);if(e)e.onchange=()=>change(key,e.checked);}
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.themeChoice;theme();saveSettings();showSettings();});
 document.querySelector('#reset-settings').onclick=()=>{settings={...defaults};theme();saveSettings();showSettings();layout();};
}
document.addEventListener('keydown',e=>{if(!current||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();turn(-1);}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistPosition();});
window.addEventListener('pagehide',()=>persistPosition());
window.addEventListener('offline',()=>message('Нет сети. Сохранённые книги доступны на этом устройстве.'));
function updateCloudStatus(){const el=document.querySelector('#cloud-status');if(el){el.textContent=cloud?.user?(cloud.running?'Синхронизация…':cloud.status==='Синхронизировано'?'Облако ✓':'Облако · ошибка'):'Облако';el.title=cloud?.status||'Облачная синхронизация';}}
function showCloud(){
 const signed=!!cloud?.user;
 const remotePositions=cloud?.remote.filter(r=>r.key.startsWith('position:')&&r.deviceId!==cloud.deviceId)||[];
 openSheet('Облачная синхронизация',`<div class="prose"><p class="sync-state">${esc(cloud?.status||'Подключаем облако…')}</p>${signed?`<p>Выполнен вход: ${esc(cloud.user.name)}</p>`:'<p>Войдите через ChatGPT на всех устройствах под одной учётной записью. Книги, настройки, закладки и место чтения будут доступны в вашем личном облаке.</p><a class="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Войти через ChatGPT</a>'}<p class="small-copy muted">Изменения сохраняются сначала на устройстве. Если сеть пропала, отправка повторится при подключении. Открытая страница не перескакивает из-за другого устройства.</p><button class="button secondary" id="sync-now">Синхронизировать сейчас</button>${remotePositions.length?'<h3>Места с других устройств</h3>':''}<div id="cloud-positions">${remotePositions.slice(0,20).map((r,i)=>{const b=books.find(b=>'position:'+b.id===r.key);return b?`<button class="chapter-row" data-remote="${i}"><span>${esc(b.title)}<small class="muted"> · ${new Date(r.clientUpdatedAt).toLocaleString('ru-RU')}</small></span></button>`:'';}).join('')}</div><p class="small-copy muted">Облако изолировано от ваших других приложений. Книги не доступны другим пользователям.</p></div>`);
 document.querySelector('#sync-now').onclick=async()=>{const b=document.querySelector('#sync-now');b.disabled=true;await cloud?.sync();showCloud();};
 document.querySelectorAll('[data-remote]').forEach(el=>el.onclick=async()=>{const record=remotePositions[Number(el.dataset.remote)],book=books.find(b=>'position:'+b.id===record.key);if(!book)return;closeSheet();if(current?.id!==book.id)await openBook(book.id);jump(record.payload.anchor);});
}
async function init(){
 app.innerHTML='<div class="boot"><div class="brand">'+icon('book')+'<span>Книга.</span></div><p>Открываем библиотеку…</p></div>';
 try{
  settings=clampSettings(await storage.getPreference('settings'));settingsUpdatedAt=await storage.getPreference('settings-updatedAt')||0;books=await storage.listBooks();
  if(!books.length){const response=await fetch(import.meta.env.BASE_URL+'sample.fb2');if(!response.ok)throw new Error('Не удалось загрузить демонстрационный фрагмент.');const original=await response.arrayBuffer();const demo=await importBook(original,'sample.fb2');const book={...demo,id:'sample',original,fileName:'sample.fb2',addedAt:Date.now(),marks:[]};await storage.putBook(book);books=[book];}
  for(const b of books){b.progress=await storage.getPreference(`position:${b.id}`);b.marks=b.progress?.marks||[];}
  await library();
  cloud=new CloudSync({books:()=>books,addBook:b=>books.push(b),status:updateCloudStatus,libraryChanged:()=>{if(!current)library();},remoteSettings:async record=>{if(record.clientUpdatedAt>settingsUpdatedAt){settings=clampSettings(record.payload);settingsUpdatedAt=record.clientUpdatedAt;await storage.setPreference('settings',settings);await storage.setPreference('settings-updatedAt',settingsUpdatedAt);theme();if(current)layout();}},remotePosition:async(book,record,marks)=>{book.marks=marks;const p=record.payload;if(!p?.anchor||!Number.isInteger(p.anchor.block)||p.anchor.block<0||p.anchor.block>=book.blocks.length||!Number.isInteger(p.anchor.offset)||p.anchor.offset<0||p.anchor.offset>book.blocks[p.anchor.block].text.length)return;if(record.clientUpdatedAt>(book.progress?.updatedAt||0)&&current?.id!==book.id){book.progress={anchor:p.anchor,marks,updatedAt:record.clientUpdatedAt};await storage.setPreference('position:'+book.id,book.progress);}const stored={...(book.progress||{anchor:{block:0,offset:0},updatedAt:0}),marks};await storage.setPreference('position:'+book.id,stored);if(current?.id===book.id)updateProgress();}});
  await cloud.init();
  if(settingsUpdatedAt&&!cloud.remote.some(r=>r.key==='settings'&&r.clientUpdatedAt>=settingsUpdatedAt))cloud.queue('settings',settings,settingsUpdatedAt);
  for(const b of books)if(b.progress?.updatedAt&&!cloud.remote.some(r=>r.key==='position:'+b.id&&r.clientUpdatedAt>=b.progress.updatedAt))cloud.queue('position:'+b.id,b.progress,b.progress.updatedAt);
  setInterval(()=>{if(document.visibilityState==='visible')cloud.sync();},30000);window.addEventListener('online',()=>cloud.sync());
 }catch(e){app.innerHTML=`<div class="startup-error"><h1>Библиотека недоступна</h1><p>${esc(e.message)}</p><button class="button primary" id="retry">Попробовать снова</button></div>`;document.querySelector('#retry').onclick=init;}
 if('serviceWorker' in navigator&&import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>message('Офлайн-режим не включился. Сохранение книг работает, но для открытия приложения понадобится сеть.',true));
}
init();
