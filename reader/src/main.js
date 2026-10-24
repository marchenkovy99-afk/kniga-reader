import {PageFlip} from '@gullabs/flipbook-core';
import {animatedTurn} from './page-turn.js';
import {attachReaderChrome} from './chrome-controls.js';
import {importBook,escapeHTML as esc} from './importer.js';
import {defaults,clampSettings,restoreSettings,pageForAnchor} from './anchors.js';
import {paginate,applyTypography} from './pagination.js';
import * as storage from './storage.js';
import {CloudSync} from './cloud.js';
import {supabase} from './supabase-client.js';
import {mergeMarks,preferRemoteAppearance,bookAppearanceKey,resolveReadingAppearance} from './sync-model.js';
import {mergeAnnotations} from './reading-features.js';
import './style.css';
import {sha256} from 'js-sha256';
import {createAppearanceWriter} from './appearance-writer.js';
const app=document.querySelector('#app');
const paths={moon:'M20.985 12.486a9 9 0 1 1-9.47-9.47c.405-.031.641.446.393.768a7 7 0 0 0 8.309 8.309c.322-.248.799-.012.768.393Z',cloud:'M7 18a5 5 0 0 1-.7-9.95A6 6 0 0 1 18 7a5.5 5.5 0 0 1 0 11H7Z',book:'M4 4h6a4 4 0 0 1 4 4v13a5 5 0 0 0-5-3H4V4Zm16 0h-6a4 4 0 0 0-4 4v13a5 5 0 0 1 5-3h5V4Z',plus:'M12 5v14M5 12h14',back:'m14 5-7 7 7 7',next:'m10 5 7 7-7 7',bookmark:'M6 3h12v18l-6-4-6 4V3Z',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',list:'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',close:'m6 6 12 12M6 18 18 6',sun:'M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',sort:'M4 7h16M7 12h10M10 17h4',more:'M5 12h.01M12 12h.01M19 12h.01',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',check:'m5 12 4 4 10-10',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const button=(name,label,id,extra='')=>`<button class="icon-button" id="${id}" aria-label="${label}" title="${label}" ${extra}>${icon(name)}</button>`;
let books=[],settings={...defaults},current=null,pages=[],pageIndex=0,flip=null,abort=null,layoutTimer,saveTimer,anchor={block:0,offset:0},busy=false,settingsTab='text',resizeObserver,lastSize='',sheetReturn=null;
let cloud=null,settingsUpdatedAt=0,globalSettings={...defaults},pageNodes=[],pageCache=new Map(),libraryStatusFilter='';
const writeAppearance=createAppearanceWriter(storage,(...args)=>cloud?.queue(...args));
const activeMarks=book=>(book.marks||[]).filter(m=>!m.deleted);

const statuses={reading:'Читаю',planned:'Хочу прочитать',finished:'Прочитано'};
const activeNotes=()=> (current?.progress?.annotations||[]).filter(x=>!x.deleted);let noteSelectTimer;
async function saveBookMeta(book){book.progress={...(book.progress||{}),updatedAt:Date.now()};await storage.setPreference('position:'+book.id,book.progress);cloud?.queue('position:'+book.id,book.progress,book.progress.updatedAt);}
function downloadText(name,body,mime='text/plain'){const url=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function fileToBase64(buffer){const bytes=new Uint8Array(buffer);let str='';for(let n=0;n<bytes.length;n+=8192)str+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(str);}
function base64ToFile(text){const binary=atob(text),bytes=new Uint8Array(binary.length);for(let n=0;n<binary.length;n++)bytes[n]=binary.charCodeAt(n);return bytes;}
function exportBackup(){try{const data={format:'kniga-backup',version:2,settings:globalSettings,books:books.filter(b=>b.id!=='sample').map(b=>({name:b.fileName,file:fileToBase64(b.original),addedAt:b.addedAt,progress:b.progress||null}))};downloadText('kniga-backup.json',JSON.stringify(data),'application/json');message('Резервная копия создана.');}catch(e){message('Не удалось создать архив: '+e.message,true);}}
async function restoreBackup(file){if(!file)return;try{if(file.size>130*1024*1024)throw Error('Архив слишком большой.');const data=JSON.parse(await file.text());if(data.format!=='kniga-backup'||data.version!==2||!Array.isArray(data.books)||data.books.length>200)throw Error('Неверный формат архива.');let count=0;for(const item of data.books){if(typeof item.name!=='string'||!/[.](fb2|zip|fbz|epub|txt)$/i.test(item.name)||typeof item.file!=='string')throw Error('Недопустимый файл книги.');const bytes=base64ToFile(item.file);if(!bytes.length||bytes.length>20*1024*1024)throw Error('Недопустимый размер книги.');const id=sha256(bytes);if(books.some(b=>b.id===id))continue;const parsed=await importBook(bytes,item.name),progress=item.progress&&typeof item.progress==='object'?item.progress:null;const b={...parsed,id,original:bytes.buffer,fileName:item.name,addedAt:Number(item.addedAt)||Date.now(),marks:progress?.marks||[],progress};await storage.putBook(b);if(progress)await storage.setPreference('position:'+id,progress);books.push(b);count++;}if(data.settings){globalSettings=restoreSettings(data.settings);settings={...globalSettings};await storage.setPreference('settings',globalSettings);}await library();cloud?.sync();message('Книг восстановлено: '+count);}catch(e){message('Ошибка восстановления: '+e.message,true);}finally{const f=document.querySelector('#backup-file');if(f)f.value='';}}

const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!settings.animation;
function message(text,error=false){let box=document.querySelector('#notification');if(!box){box=document.createElement('div');box.id='notification';box.setAttribute('role','status');document.body.append(box);}box.className=error?'notice error':'notice';box.textContent=text;box.hidden=false;clearTimeout(box.timer);box.timer=setTimeout(()=>box.hidden=true,error?10000:5000);}
function theme(){
 const actual=settings.theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'night':'white'):settings.theme;
 const isDark=actual==='night'||actual==='oled';
 document.documentElement.dataset.theme=actual;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',getComputedStyle(document.body).getPropertyValue('--paper').trim());
 const toggle=document.querySelector('#library-theme');
 if(toggle){
  const label=isDark?'Включить светлую тему':'Включить тёмную тему';
  toggle.innerHTML=icon(isDark?'sun':'moon');
  toggle.setAttribute('aria-label',label);
  toggle.title=label;
  toggle.setAttribute('aria-pressed',String(isDark));
 }
}
function fileInput(){return '<input id="file-input" type="file" accept=".fb2,.fb2.zip,.fbz,.zip,.epub,.txt" hidden multiple />';}
function ensureSheet(){if(!document.querySelector('#sheet')){const d=document.createElement('dialog');d.id='sheet';document.body.append(d);d.addEventListener('click',e=>{if(e.target===d)closeSheet();});d.addEventListener('close',()=>{sheetReturn?.focus();});}}
function openSheet(title,html,wide=false){ensureSheet();const d=document.querySelector('#sheet');sheetReturn=document.activeElement;d.className=wide?'sheet wide':'sheet';d.innerHTML=`<div class="handle"></div><header class="sheet-header"><h2>${title}</h2>${button('close','Закрыть','close-sheet')}</header><div class="sheet-content">${html}</div>`;d.querySelector('#close-sheet').onclick=closeSheet;if(!d.open)d.showModal();}
function closeSheet(){document.querySelector('#sheet')?.close();}
function dispose(){abort?.abort();clearTimeout(layoutTimer);resizeObserver?.disconnect();resizeObserver=null;pageNodes=[];if(flip){flip.destroy();flip=null;}pages=[];}
async function persistPosition(){if(!current)return;const id=current.id;const data={...(current.progress||{}),anchor:{...anchor},marks:current.marks||[],updatedAt:Date.now()};current.progress=data;try{await storage.setPreference(`position:${id}`,data);cloud?.queue(`position:${id}`,data,data.updatedAt);}catch(e){message(e.message,true);}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persistPosition,220);}
function progressFor(b){const a=b.progress?.anchor;if(!a)return 0;const before=b.blocks.slice(0,a.block).reduce((sum,x)=>sum+x.text.length,0)+a.offset;return Math.max(0,Math.min(100,Math.round(before/Math.max(1,b.chars)*100)));}
function cover(b,small=false){return `<div class="cover ${small?'small':''}" data-color="${b.id==='sample'?'green':'brown'}">${b.cover?`<img src="${b.cover}" alt="Обложка книги ${esc(b.title)}">`:`<div class="cover-author">${esc(b.author)}</div><div class="cover-title">${esc(b.title)}</div><div class="cover-rule"></div><span class="cover-format">${esc(b.format)}</span>`}</div>`;}
async function library(){
 await persistPosition();dispose();current=null;settings={...globalSettings};document.body.classList.remove('reading');libraryStatusFilter='';theme();
 app.innerHTML=`<div class="library"><header class="library-top"><a class="brand" href="#" aria-label="Книга: библиотека"><img class="brand-symbol" src="./icon-192.png?v=3" width="30" height="30" alt="" aria-hidden="true"><span>Книга</span></a><div class="library-actions"><button class="icon-button library-theme-toggle" id="library-theme" aria-label="Включить тёмную тему">${icon('moon')}</button><button id="cloud-status" class="cloud-status" aria-label="Облачная синхронизация">${icon('cloud')}<span>Облако</span></button></div></header><main><div class="library-heading"><h1>Библиотека</h1><button class="button primary import-button">${icon('plus')}<span>Добавить</span></button></div><label class="library-search">${icon('search')}<input id="library-search" type="search" placeholder="Название книги или автор" aria-label="Найти книгу в библиотеке"></label><section id="continue-slot" aria-label="Продолжить чтение"></section><div class="shelf-top"><div class="shelf-heading"><h2>Все книги</h2><span class="shelf-count">${books.length}</span></div><label class="shelf-sort"><span class="sr-only">Сортировка</span>${icon('sort')}<select id="library-sort" aria-label="Сортировка"><option value="recent">Недавние</option><option value="title">По названию</option><option value="author">По автору</option><option value="progress">По прогрессу</option></select></label></div><div class="shelf-controls"><div class="status-tabs" role="group" aria-label="Фильтр книг"><button type="button" data-library-status="" aria-pressed="true">Все</button><button type="button" data-library-status="reading" aria-pressed="false">Читаю</button><button type="button" data-library-status="planned" aria-pressed="false">В планах</button><button type="button" data-library-status="finished" aria-pressed="false">Прочитано</button></div><label class="shelf-collection"><span class="sr-only">Коллекция</span><select id="library-collection" aria-label="Коллекция"><option value="">Все коллекции</option>${[...new Set(books.map(b=>b.progress?.collection).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label></div><div id="book-grid" class="book-grid"></div></main><footer class="library-footer"><div class="library-backups"><button id="export-backup" class="text-button">Копия</button><button id="restore-backup" class="text-button">Восстановить</button></div><button id="about" class="text-button">О приложении ${icon('next')}</button></footer></div>${fileInput()}<input id="backup-file" type="file" accept=".json,application/json" hidden>`;
 document.querySelector('#library-theme').onclick=()=>{settings.theme=['night','oled'].includes(document.documentElement.dataset.theme)?'paper':'night';theme();saveSettings();};theme();
 const last=[...books].filter(b=>b.progress?.updatedAt).sort((a,b)=>b.progress.updatedAt-a.progress.updatedAt)[0];
 if(last)document.querySelector('#continue-slot').innerHTML=`<article class="continue"><div class="continue-cover">${cover(last,true)}</div><div class="continue-copy"><span class="section-label">Сейчас читаю</span><h2>${esc(last.title)}</h2><p>${esc(last.author)}</p><div class="continue-progress"><progress max="100" value="${progressFor(last)}" aria-label="Прочитано ${progressFor(last)}%"></progress><span>${progressFor(last)}%</span></div><button class="text-button" id="continue-book">Продолжить ${icon('next')}</button></div></article>`;
 document.querySelector('#cloud-status').onclick=showCloud;updateCloudStatus();
 document.querySelector('#continue-book')?.addEventListener('click',()=>openBook(last.id));
 renderGrid('');document.querySelector('#library-search').oninput=e=>renderGrid(e.target.value);document.querySelectorAll('[data-library-status]').forEach(tab=>tab.onclick=()=>{libraryStatusFilter=tab.dataset.libraryStatus;document.querySelectorAll('[data-library-status]').forEach(x=>x.setAttribute('aria-pressed',String(x===tab)));renderGrid(document.querySelector('#library-search').value);});if(document.querySelector('#library-collection').options.length<2)document.querySelector('.shelf-collection').hidden=true;document.querySelector('#library-collection').onchange=()=>renderGrid(document.querySelector('#library-search').value);document.querySelector('#library-sort').onchange=()=>renderGrid(document.querySelector('#library-search').value);
 document.querySelectorAll('.import-button').forEach(b=>b.onclick=()=>document.querySelector('#file-input').click());
 document.querySelector('#file-input').onchange=e=>handleFiles(e.target.files);document.querySelector('#export-backup').onclick=exportBackup;document.querySelector('#restore-backup').onclick=()=>document.querySelector('#backup-file').click();document.querySelector('#backup-file').onchange=e=>restoreBackup(e.target.files[0]);
 document.querySelector('#about').onclick=()=>openSheet('О читалке',`<div class="prose"><p>Читалка для ваших FB2, FB2.zip, EPUB без DRM и TXT. Файл книги, настройки и место чтения сохраняются на этом устройстве. При включённом облаке они доступны и на других устройствах.</p><p>При очистке данных браузера библиотека удалится. Исходный файл можно скачать в меню книги. ${import.meta.env.MODE==='pages'?'Для синхронизации войдите в облако по почте и паролю.':'Облачная синхронизация доступна после входа через ChatGPT.'} Книги и прогресс привязаны к вашей учётной записи.</p><p>Формат PDF и EPUB с фиксированной вёрсткой пока не поддерживаются. Издательские стили EPUB заменяются настройками читалки.</p><p>Лимиты черновика: файл 20 МБ, распаковка 60 МБ, 2 млн символов. Неподдерживаемые файлы отклоняются целиком.</p></div>`);
}
function renderGrid(query){
 const filter=libraryStatusFilter,sort=document.querySelector('#library-sort')?.value||'recent',collection=document.querySelector('#library-collection')?.value||'';const found=books.filter(b=>(b.title+' '+b.author+' '+(b.progress?.collection||'')).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))&&(!filter||(b.progress?.status||'reading')===filter)&&(!collection||b.progress?.collection===collection));found.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'ru'):sort==='author'?a.author.localeCompare(b.author,'ru'):sort==='progress'?progressFor(b)-progressFor(a):(b.progress?.updatedAt||b.addedAt||0)-(a.progress?.updatedAt||a.addedAt||0));
 document.querySelector('#book-grid').innerHTML=found.length?found.map(b=>`<article class="book-card"><button class="book-open" data-book="${b.id}" aria-label="Открыть книгу ${esc(b.title)}">${cover(b)}</button><div class="book-meta"><div><h3>${esc(b.title)}</h3><p>${esc(b.author)}</p><span>${b.id==='sample'?'Фрагмент':esc(statuses[b.progress?.status]||'Читаю')} · ${progressFor(b)}%${b.progress?.collection?' · '+esc(b.progress.collection):''}</span></div><button class="icon-button book-more" data-info="${b.id}" aria-label="О книге ${esc(b.title)}">${icon('more')}</button></div></article>`).join(''):'<div class="empty"><h3>Книга не найдена</h3><p>Попробуйте другое название или автора.</p></div>';
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
 openSheet('О книге',`<div class="prose"><h3>${esc(b.title)}</h3><p>${esc(b.author)}</p><dl><dt>Формат</dt><dd>${b.format}</dd><dt>Объём текста</dt><dd>${b.chars.toLocaleString('ru-RU')} знаков</dd><dt>Разделов в оглавлении</dt><dd>${b.chapters.length}</dd></dl>${b.warnings.length?'<h3>Замечания при импорте</h3>'+b.warnings.map(w=>`<p>${esc(w)}</p>`).join(''):''}<label class="select-setting"><span>Статус</span><select id="book-status"><option value="reading">Читаю</option><option value="planned">В планах</option><option value="finished">Прочитано</option></select></label><label class="select-setting"><span>Коллекция</span><input id="book-collection" maxlength="48" placeholder="Например, История" value="${esc(b.progress?.collection||'')}"></label><p class="muted">Настройки оформления не изменяют исходный файл.</p><button id="download-original" class="button secondary">${icon('download')} Скачать исходный файл</button><button id="remove-book" class="text-button danger">Убрать с полки</button></div>`);
 document.querySelector('#download-original').onclick=()=>downloadBook(b);const state=document.querySelector('#book-status');state.value=b.progress?.status||'reading';state.onchange=async()=>{b.progress={...(b.progress||{}),status:state.value};await saveBookMeta(b);};document.querySelector('#book-collection').onchange=async e=>{b.progress={...(b.progress||{}),collection:e.target.value.trim().slice(0,48)};await saveBookMeta(b);};
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
 try{
  const appearance=await storage.getPreference(bookAppearanceKey(id));
  if(appearance?.settings&&Number(appearance.updatedAt)>Number(b.appearanceUpdatedAt||0)){
   b.appearanceSettings=restoreSettings(appearance.settings);b.appearanceUpdatedAt=appearance.updatedAt;
  }
 }catch(e){message('Настройки текста не загрузились: '+e.message,true);}
 const effectiveAppearance=resolveReadingAppearance({settings:globalSettings,updatedAt:settingsUpdatedAt},{settings:b.appearanceSettings||b.progress?.bookSettings,updatedAt:b.appearanceUpdatedAt||b.progress?.appearanceUpdatedAt||0});
 settings=restoreSettings(effectiveAppearance.settings);theme();
 document.body.classList.add('reading');theme();
 app.innerHTML=`<div class="reader ${reduced()?'':'reader-enter'}"><header class="reader-header">${button('back','В библиотеку','to-library')}<div class="reader-heading"><span>${esc(b.title)}</span><small>${esc(b.author)}</small></div>${button('bookmark','Поставить закладку','toggle-bookmark','aria-pressed="false"')}</header><main id="book-stage" class="book-stage" aria-label="Страницы книги"><div id="page-loading" class="page-loading" role="status">Готовим страницы…</div></main><footer class="reader-footer"><div class="page-status"><span id="reading-percent">0% книги</span><span id="page-count"></span></div><input id="reading-progress" class="reading-progress" type="range" min="0" max="1" value="0" step="1" aria-label="Перейти на страницу"><nav class="reader-tools" aria-label="Управление чтением">${button('list','Оглавление и закладки','contents')}${button('search','Поиск по книге','search-book')}<button class="icon-button type-button" id="appearance" aria-label="Оформление текста" title="Оформление текста">Aa</button>${button('sun','Сменить тему','cycle-theme')}<div class="nav-arrows">${button('back','Предыдущая страница','prev-page')}${button('next','Следующая страница','next-page')}</div></nav></footer></div>`;
 attachReaderChrome(document.querySelector('#book-stage'),turn);
 document.querySelector('#to-library').onclick=library;document.querySelector('#toggle-bookmark').onclick=toggleBookmark;
 document.querySelector('#contents').onclick=showContents;document.querySelector('#search-book').onclick=showSearch;
 document.querySelector('#appearance').onclick=showSettings;document.querySelector('#cycle-theme').onclick=()=>{settings.theme=['paper','white','night','oled','auto'][(['paper','white','night','oled','auto'].indexOf(settings.theme)+1)%5];theme();saveSettings();};
 document.querySelector('#prev-page').onclick=()=>turn(-1);document.querySelector('#next-page').onclick=()=>turn(1);
 document.querySelector('#reading-progress').oninput=e=>{const el=e.target;el.style.setProperty('--reader-progress',`${Number(el.max)>0?Number(el.value)/Number(el.max)*100:0}%`);el.setAttribute('aria-valuetext',`Страница ${Number(el.value)+1} из ${pages.length}`);};
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
 const target={...anchor},snapshot={...settings};const cacheKey=current.id+'|'+width+'|'+height+'|'+JSON.stringify(snapshot);
 try{
  await document.fonts.ready;
  let result=pageCache.get(cacheKey);if(!result){result=await paginate(current.blocks,{width,height,settings:snapshot,signal:controller.signal,onProgress:p=>loader.textContent=`Готовим страницы · ${p}%`});pageCache.set(cacheKey,result);if(pageCache.size>3)pageCache.delete(pageCache.keys().next().value);}
  if(controller.signal.aborted)return;
  if(flip){flip.destroy();flip=null;}
  stage.innerHTML='';pages=result;pageIndex=pageForAnchor(pages,target);
  const book=document.createElement('div');book.id='flipbook';book.setAttribute('aria-label','Книга с перелистыванием страниц');stage.append(book);
  const nodes=pages.map((p,i)=>{const node=document.createElement('section');node.className='book-page';node.setAttribute('data-density','soft');node.setAttribute('aria-label',`Страница ${i+1}`);return node;});pageNodes=nodes;hydrateAround(pageIndex);
  flip=new PageFlip(book,{width,height,sizing:'fixed',initialPage:pageIndex,hardCovers:false,drawShadow:true,maxShadowOpacity:0.24,flippingTime:550,allowTouchScroll:true,respectInteractiveContent:true,pointerInput:[],foldCornerOnHover:false,flipOnClick:'never',swipeDistance:35,pageBackground:'var(--paper)',respectReducedMotion:true});
  let initializing=true;
  flip.on('flip',e=>{if(initializing)return;pageIndex=e.data.page;anchor={...pages[pageIndex].start};hydrateAround(pageIndex);updateProgress();current.progress={...current.progress,updatedAt:Date.now()};scheduleSave();});
  flip.loadFromHTML(nodes);flip.turnToPage(pageIndex);initializing=false;
  book.addEventListener('click',e=>{const a=e.target.closest('[data-note]');if(a){e.preventDefault();showNote(a.dataset.note);return;}const mark=e.target.closest('[data-annotation]');if(mark){e.preventDefault();showReadingNotes(mark.dataset.annotation);}});
  anchor=target; // Keep the precise source anchor through consecutive typography edits.
  updateProgress();scheduleSave();
 }catch(e){if(e.name!=='AbortError'){loader.textContent=e.message;loader.classList.add('layout-error');message(e.message,true);}}
}
function hydrateAround(center){const stage=document.querySelector('#book-stage'),width=Math.floor(stage?.clientWidth||400);for(let i=Math.max(0,center-5);i<=Math.min(pageNodes.length-1,center+5);i++){const node=pageNodes[i];if(!node||node.dataset.ready==='yes')continue;node.innerHTML=`<div class="book-text" data-page="${i}">${pages[i].html}</div>`;applyTypography(node.querySelector('.book-text'),settings,width);node.dataset.ready='yes';renderNotesOnPage(node);}}
function updateProgress(){
 if(!current||!pages.length)return;
 const before=current.blocks.slice(0,anchor.block).reduce((sum,b)=>sum+b.text.length,0)+anchor.offset;
 const percent=Math.round(before/Math.max(1,current.chars)*100);
 document.querySelector('#reading-percent').textContent=`${Math.min(100,percent)}% книги`;
 document.querySelector('#page-count').textContent=`${pageIndex+1} / ${pages.length}`;
 const progress=document.querySelector('#reading-progress');progress.max=pages.length-1;progress.value=pageIndex;progress.style.setProperty('--reader-progress',`${pages.length>1?pageIndex/(pages.length-1)*100:0}%`);
 progress.setAttribute('aria-valuetext',`Страница ${pageIndex+1} из ${pages.length}`);
 document.querySelector('#prev-page').disabled=pageIndex===0;document.querySelector('#next-page').disabled=pageIndex>=pages.length-1;
 const marked=activeMarks(current).some(m=>pageForAnchor(pages,m.anchor)===pageIndex);
 document.querySelector('#toggle-bookmark').classList.toggle('marked',marked);document.querySelector('#toggle-bookmark').setAttribute('aria-pressed',String(marked));
 // Only the active page is exposed to assistive technology; physical page layers stay visual.
 document.querySelectorAll('.book-page').forEach((el,i)=>el.setAttribute('aria-hidden',String(i!==pageIndex)));
}
function turn(dir){if(!flip||!pages.length)return;const next=flip.getCurrentPageIndex()+dir;if(next<0||next>=pages.length||!flip.isReady()||flip.isAnimating())return;hydrateAround(next);if(reduced()){goPage(next);return;}animatedTurn(flip,dir,pages.length);}
function goPage(index){if(!flip||!pages.length)return;pageIndex=Math.max(0,Math.min(pages.length-1,index));hydrateAround(pageIndex);flip.turnToPage(pageIndex);anchor={...pages[pageIndex].start};current.progress={...current.progress,updatedAt:Date.now()};updateProgress();scheduleSave();}
function jump(target){closeSheet();if(!pages.length)return;goPage(pageForAnchor(pages,target));anchor={...target};updateProgress();scheduleSave();}
function toggleBookmark(){
 if(!current||!pages.length)return;
 const marks=current.marks||[],existing=activeMarks(current).find(m=>pageForAnchor(pages,m.anchor)===pageIndex);
 const mark=existing?{...existing,deleted:true,changedAt:Date.now()}:{anchor:{...anchor},label:current.blocks[anchor.block]?.text.slice(anchor.offset,anchor.offset+90)||current.title,changedAt:Date.now(),deleted:false};
 current.marks=mergeMarks(marks,[mark]);current.progress={...current.progress,updatedAt:Date.now()};updateProgress();persistPosition();message(existing?'Закладка снята.':'Закладка сохранена.');
}
function showContents(){
 const marks=activeMarks(current);
 openSheet('Оглавление и закладки',`<label class="search-field">${icon('search')}<input id="chapter-search" type="search" placeholder="Название главы" aria-label="Поиск по оглавлению"></label><div class="contents-list">${current.chapters.map(c=>`<button class="chapter-row ${c.level===2?'subchapter':''}" data-jump="${c.block}"><span>${esc(c.title)}</span>${icon('next')}</button>`).join('')}</div><button class="chapter-row" id="open-reader-notes">Цитаты и заметки <span>${activeNotes().length}</span></button><h3 class="subheading">Закладки <span>${marks.length}</span></h3>${marks.length?marks.map((m,i)=>`<button class="chapter-row bookmark-row" data-mark="${i}">${icon('bookmark')}<span>${esc(m.label)}</span></button>`).join(''):'<p class="muted small-copy">Нажмите значок закладки над страницей, чтобы вернуться к этому месту.</p>'}`);
 document.querySelector('#chapter-search').oninput=e=>{const query=e.target.value.toLocaleLowerCase('ru');document.querySelectorAll('[data-jump]').forEach(b=>b.hidden=!b.textContent.toLocaleLowerCase('ru').includes(query));};document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump({block:Number(b.dataset.jump),offset:0}));document.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>jump(marks[Number(b.dataset.mark)].anchor));document.querySelector('#open-reader-notes').onclick=()=>showReadingNotes();
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
function saveSettings(){
 const saved=restoreSettings(settings),at=Math.max(Date.now(),settingsUpdatedAt+1,(current?.appearanceUpdatedAt||0)+1);
 globalSettings={...saved};settingsUpdatedAt=at;
 const book=current;
 if(book){
  book.appearanceSettings={...saved};book.appearanceUpdatedAt=at;
  book.progress={...(book.progress||{}),bookSettings:{...saved},appearanceUpdatedAt:at};scheduleSave();
 }
 writeAppearance({bookId:book?.id,settings:saved,updatedAt:at}).catch(e=>message('Не удалось сохранить оформление: '+e.message,true));
}
function refreshAppearanceControls(){
 const sheet=document.querySelector('#sheet');
 if(sheet?.open&&document.querySelector('#reset-settings')){
  const focusId=document.activeElement?.id;showSettings();if(focusId)document.getElementById(focusId)?.focus();
 }
}
function applyLiveAppearance(next){
 settings={...next};theme();refreshAppearanceControls();
 if(current){clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>layout(),300);}
}

const ranges={fontSize:['Размер текста',12,48,1,'px'],lineHeight:['Межстрочный интервал',1,2.5,.05,'×'],margin:['Боковые поля',8,72,1,'px'],paragraphGap:['Между абзацами',0,2,.1,'em'],indent:['Отступ первой строки',0,3,.1,'em'],letterSpacing:['Между буквами',-.5,3,.1,'px']};
function rangeControl(key){const [label,min,max,step,unit]=ranges[key];return `<div class="setting-control"><div class="setting-title"><label for="range-${key}">${label}</label><div class="exact-value"><input type="number" id="number-${key}" aria-label="${label}: точное значение" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><span>${unit}</span></div></div><div class="range-row"><button class="step-button" data-step="${key}:-1" aria-label="Уменьшить: ${label}">−</button><input id="range-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-setting="${key}"><button class="step-button" data-step="${key}:1" aria-label="Увеличить: ${label}">+</button></div></div>`;}
function showSettings(){
 const tabs=`<div class="preset-strip" aria-label="Оформление текста"><button data-preset="novel">Роман</button><button data-preset="nonfiction">Нонфикшн</button><button data-preset="compact">Компактно</button></div><div class="segmented" role="tablist" aria-label="Раздел настроек"><button role="tab" data-tab="text" aria-selected="${settingsTab==='text'}">Текст</button><button role="tab" data-tab="page" aria-selected="${settingsTab==='page'}">Страница</button><button role="tab" data-tab="themes" aria-selected="${settingsTab==='themes'}">Темы</button></div>`;
 let html='';
 if(settingsTab==='text')html=`<label class="select-setting"><span>Шрифт</span><select id="font-select" aria-label="Шрифт"><option value="serif">Книжный</option><option value="literary">Классический</option><option value="sans">Без засечек</option></select></label>${rangeControl('fontSize')}${rangeControl('lineHeight')}<details class="advanced"><summary>Ещё настройки текста</summary>${rangeControl('paragraphGap')}${rangeControl('indent')}${rangeControl('letterSpacing')}<label class="select-setting"><span>Выравнивание</span><select id="align-select" aria-label="Выравнивание"><option value="left">По левому краю</option><option value="justify">По ширине</option></select></label><label class="switch-row"><span>Переносы слов</span><input type="checkbox" id="hyphens-check" ${settings.hyphens?'checked':''}></label></details>`;
 if(settingsTab==='page')html=`${rangeControl('margin')}<p class="small-copy muted">Поля применяются симметрично. На узком экране сохраняется место для читаемого текста.</p><label class="switch-row"><span>Переворот страницы</span><input type="checkbox" id="animation-check" ${settings.animation?'checked':''}></label><p class="small-copy muted">Изгиб страницы с тенью. При системном уменьшении движения используется мгновенный переход.</p><p class="small-copy muted">Чтобы листать, проведите по странице, потяните её за угол или используйте стрелки.</p>`;
 if(settingsTab==='themes')html=`<div class="theme-options">${[['paper','Бумага'],['white','Светлая'],['night','Ночная'],['oled','Чёрная'],['auto','Авто']].map(([key,label])=>`<button class="theme-option" data-theme-choice="${key}" aria-pressed="${settings.theme===key}"><span class="theme-sample ${key}">Aa</span><span>${label}</span>${settings.theme===key?icon('check'):''}</button>`).join('')}</div><p class="small-copy muted">Тема меняет фон страницы и интерфейса. Положение в книге сохраняется.</p>`;
 openSheet('Оформление',tabs+`<div class="settings-body">${html}</div><div class="settings-bottom"><span>Изменения видны сразу</span><button id="reset-settings" class="text-button">Сбросить</button></div>`);
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{settingsTab=b.dataset.tab;showSettings();});
 const change=(key,value)=>{settings=clampSettings({...settings,[key]:value});saveSettings();syncControls(key);clearTimeout(layoutTimer);layoutTimer=setTimeout(layout,420);};document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const presets={novel:{fontSize:22,lineHeight:1.55,margin:24,paragraphGap:0,indent:1.3},nonfiction:{fontSize:20,lineHeight:1.5,margin:20,paragraphGap:.3,indent:0},compact:{fontSize:19,lineHeight:1.35,margin:12,paragraphGap:0,indent:1}};settings=clampSettings({...settings,...presets[b.dataset.preset]});saveSettings();showSettings();clearTimeout(layoutTimer);layoutTimer=setTimeout(layout,430);});
 const syncControls=key=>{for(const prefix of ['range-','number-']){const el=document.getElementById(prefix+key);if(el&&!(el.type==='number'&&document.activeElement===el))el.value=settings[key];}};
 document.querySelectorAll('[data-setting]').forEach(e=>e.oninput=()=>change(e.dataset.setting,Number(e.value)));
 for(const key of Object.keys(ranges)){const input=document.getElementById('number-'+key);if(input){input.oninput=()=>{const n=Number(input.value);if(input.value!==''&&Number.isFinite(n)&&n>=ranges[key][1]&&n<=ranges[key][2])change(key,n);};input.onchange=()=>{change(key,input.value===''?defaults[key]:Number(input.value));input.value=settings[key];};}}
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const[key,d]=b.dataset.step.split(':');change(key,Math.round((settings[key]+Number(d)*ranges[key][3])*100)/100);});
 for(const [id,key] of [['font-select','font'],['align-select','align']]){const e=document.getElementById(id);if(e){e.value=settings[key];e.onchange=()=>change(key,e.value);}}
 for(const [id,key] of [['hyphens-check','hyphens'],['animation-check','animation']]){const e=document.getElementById(id);if(e)e.onchange=()=>change(key,e.checked);}
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.themeChoice;theme();saveSettings();showSettings();});
 document.querySelector('#reset-settings').onclick=()=>{settings={...(current?globalSettings:defaults)};theme();saveSettings();showSettings();layout();};
}

/** Inject highlights into original text nodes without changing text length or character anchors. */
function renderNotesOnPage(page){
 const annotations=activeNotes();if(!annotations.length)return;
 for(const paragraph of page.querySelectorAll('.paragraph[data-block]')){
  const block=Number(paragraph.dataset.block),startAt=Number(paragraph.dataset.from||0);
  const matches=annotations.filter(a=>a.start.block<=block&&a.end.block>=block);
  if(!matches.length)continue;
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),parts=[];let node,pos=startAt;
  while((node=walker.nextNode())){parts.push({node,from:pos,to:pos+node.length});pos+=node.length;}
  for(const part of parts){
   const edges=[part.from,part.to];
   for(const ann of matches){
    const from=ann.start.block===block?ann.start.offset:0,to=ann.end.block===block?ann.end.offset:Infinity;
    if(from>part.from&&from<part.to)edges.push(from);
    if(to>part.from&&to<part.to)edges.push(to);
   }
   const cuts=[...new Set(edges.sort((a,b)=>a-b))],fragment=document.createDocumentFragment();
   for(let i=0;i<cuts.length-1;i++){
    const from=cuts[i],to=cuts[i+1],str=part.node.nodeValue.slice(from-part.from,to-part.from);
    const active=matches.filter(a=>(a.start.block<block||a.start.offset<=from)&&(a.end.block>block||a.end.offset>=to)).sort((a,b)=>b.changedAt-a.changedAt)[0];
    if(active){const mark=document.createElement('mark');mark.className='reading-highlight '+active.color;mark.dataset.annotation=active.id;mark.textContent=str;fragment.append(mark);}
    else fragment.append(document.createTextNode(str));
   }
   part.node.replaceWith(fragment);
  }
 }
}
function refreshNotesOnPage(){
 for(const node of pageNodes){if(node?.dataset.ready==='yes'){node.dataset.ready='';node.replaceChildren();}}
 hydrateAround(pageIndex);
}
function selectionAnchor(){
 const sel=window.getSelection();if(!sel||sel.isCollapsed||!sel.toString().trim())return null;
 const range=sel.getRangeAt(0);
 const sourcePoint=(node,offset)=>{
  const el=node.nodeType===1?node:node.parentElement,paragraph=el?.closest('.paragraph[data-block]');
  if(!paragraph||!paragraph.closest('#book-stage'))return null;
  const prefix=document.createRange();prefix.selectNodeContents(paragraph);
  try{prefix.setEnd(node,offset);}catch{return null;}
  return {block:Number(paragraph.dataset.block),offset:Number(paragraph.dataset.from||0)+prefix.toString().length};
 };
 const start=sourcePoint(range.startContainer,range.startOffset),end=sourcePoint(range.endContainer,range.endOffset);
 if(!start||!end||end.block<start.block||(end.block===start.block&&end.offset<=start.offset))return null;
 return {start,end,text:sel.toString().slice(0,3000)};
}
function offerQuoteActions(){
 document.querySelector('#quote-actions')?.remove();
 if(!current||document.querySelector('dialog[open]'))return;
 const quote=selectionAnchor();if(!quote)return;
 const tools=document.createElement('div');tools.id='quote-actions';tools.className='quote-actions';
 tools.innerHTML='<button id="quote-save">Выделить</button><button id="quote-note">Заметка</button><button id="quote-copy">Копировать</button>';
 document.body.append(tools);tools.addEventListener('pointerdown',e=>e.preventDefault());
 const save=note=>{const value={...quote,id:crypto.randomUUID(),note,color:'gold',changedAt:Date.now(),deleted:false};
  current.progress={...(current.progress||{}),annotations:mergeAnnotations(current.progress?.annotations||[],[value])};
  tools.remove();window.getSelection()?.removeAllRanges();refreshNotesOnPage();scheduleSave();message('Цитата сохранена.');
 };
 tools.querySelector('#quote-save').onclick=()=>save('');
 tools.querySelector('#quote-copy').onclick=async()=>{try{await navigator.clipboard.writeText(quote.text);message('Скопировано.');}catch{message('Скопировать не удалось.',true);}tools.remove();};
 tools.querySelector('#quote-note').onclick=()=>{tools.remove();
  openSheet('Заметка к цитате',`<blockquote class="quoted">${esc(quote.text)}</blockquote><label class="note-label" for="note-editor">Комментарий</label><textarea id="note-editor" rows="5" maxlength="5000"></textarea><button id="note-save" class="button primary">Сохранить</button>`);
  document.querySelector('#note-save').onclick=()=>{const value=document.querySelector('#note-editor').value;closeSheet();save(value);};
 };
}
function showReadingNotes(focus=''){
 const notes=activeNotes(),shown=focus?[...notes].sort((a,b)=>(a.id===focus?-1:0)-(b.id===focus?-1:0)):notes;
 openSheet('Цитаты и заметки',`<p class="small-copy muted">Выделите текст на странице, чтобы сохранить цитату.</p><div class="notes-list">${shown.length?shown.map(n=>`<article class="note-item"><blockquote>${esc(n.text)}</blockquote>${n.note?`<p>${esc(n.note)}</p>`:''}<div class="note-item-actions"><button data-annotation-jump="${esc(n.id)}">Перейти</button><button data-annotation-edit="${esc(n.id)}">Изменить</button><button data-annotation-delete="${esc(n.id)}">Удалить</button></div></article>`).join(''):'<p class="muted">Пока нет заметок.</p>'}</div><button id="export-notes" class="button secondary">Экспортировать в Markdown</button>`);
 document.querySelectorAll('[data-annotation-jump]').forEach(b=>b.onclick=()=>{const note=notes.find(n=>n.id===b.dataset.annotationJump);if(note)jump(note.start);});
 document.querySelectorAll('[data-annotation-edit]').forEach(b=>b.onclick=()=>{const note=notes.find(n=>n.id===b.dataset.annotationEdit);if(!note)return;
  openSheet('Редактировать заметку',`<blockquote class="quoted">${esc(note.text)}</blockquote><label class="note-label" for="note-editor">Комментарий</label><textarea id="note-editor" rows="5" maxlength="5000">${esc(note.note)}</textarea><button id="note-save" class="button primary">Сохранить</button>`);
  document.querySelector('#note-save').onclick=()=>{current.progress.annotations=mergeAnnotations(current.progress.annotations,[{...note,note:document.querySelector('#note-editor').value,changedAt:Date.now()}]);scheduleSave();showReadingNotes(note.id);};
 });
 document.querySelectorAll('[data-annotation-delete]').forEach(b=>b.onclick=()=>{const note=notes.find(n=>n.id===b.dataset.annotationDelete);if(!note)return;current.progress.annotations=mergeAnnotations(current.progress.annotations,[{...note,changedAt:Date.now(),deleted:true}]);scheduleSave();refreshNotesOnPage();showReadingNotes();});
 document.querySelector('#export-notes').onclick=()=>{const text='# '+current.title+'\n\n'+notes.map(n=>'> '+n.text.replace(/\n/g,'\n> ')+'\n\n'+(n.note?n.note+'\n\n':'')).join('---\n\n');downloadText('kniga-notes.md',text,'text/markdown');};
}
document.addEventListener('selectionchange',()=>{clearTimeout(noteSelectTimer);noteSelectTimer=setTimeout(offerQuoteActions,250);});
document.addEventListener('pointerup',()=>{if(current){clearTimeout(noteSelectTimer);noteSelectTimer=setTimeout(offerQuoteActions,260);}});

document.addEventListener('keydown',e=>{if(!current||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();document.querySelector('.reader')?.classList.toggle('chrome-hidden');return;}if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();turn(-1);}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistPosition();});
window.addEventListener('pagehide',()=>persistPosition());matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(settings.theme==='auto')theme();});
window.addEventListener('offline',()=>message('Нет сети. Сохранённые книги доступны на этом устройстве.'));
function updateCloudStatus(){const el=document.querySelector('#cloud-status');if(el){const label=cloud?.user?(cloud.running?'Синхронизация':cloud.status==='Синхронизировано'?'Сохранено':cloud.error?'Ошибка облака':'Проверить облако'):'Облако';el.innerHTML=icon('cloud')+'<span>'+label+'</span>';el.dataset.state=cloud?.user&&cloud.status==='Синхронизировано'?'saved':'idle';el.title=cloud?.status||'Облачная синхронизация';}}
function showCloud(){


 if(import.meta.env.MODE==='pages'&&!cloud?.user){
  openSheet('Ваше облако',`<div class="prose"><p>Войдите под одной учётной записью на всех устройствах. Книги, закладки, оформление и место чтения сохраняются в вашем личном облаке.</p><form id="cloud-login" class="cloud-login"><label>Электронная почта<input type="email" id="cloud-email" autocomplete="username" required></label><label>Пароль<input type="password" id="cloud-password" autocomplete="current-password" minlength="8" required></label><p id="cloud-feedback" role="status" aria-live="polite"></p><button class="button primary" type="submit">Войти</button><button class="button secondary" type="button" id="cloud-signup">Создать аккаунт</button></form><p class="small-copy muted">Книги доступны только вам. На другом устройстве войдите с той же почтой и паролем.</p></div>`);
  const form=document.querySelector('#cloud-login');
  const authenticate=async signup=>{
   if(!form.reportValidity())return;
   const feedback=document.querySelector('#cloud-feedback'),buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);feedback.textContent='Подключаемся…';
   try{const email=document.querySelector('#cloud-email').value.trim(),password=document.querySelector('#cloud-password').value;
    const {data,error}=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!data.session){feedback.textContent='Подтвердите адрес по письму Supabase, затем вернитесь сюда и нажмите «Войти». После подтверждения письма можно закрыть открывшуюся страницу.';return;}
    document.querySelector('#cloud-password').value='';await cloud.sync();showCloud();
   }catch(e){feedback.textContent=e.message==='Invalid login credentials'?'Неверная почта или пароль. Проверьте данные и подтверждение почты.':e.message;}finally{buttons.forEach(b=>b.disabled=false);}
  };
  form.onsubmit=e=>{e.preventDefault();authenticate(false);};document.querySelector('#cloud-signup').onclick=()=>authenticate(true);return;
 }
 const signed=!!cloud?.user;
 const remotePositions=cloud?.remote.filter(r=>r.key.startsWith('position:')&&r.deviceId!==cloud.deviceId)||[];
 const pendingCount=Object.keys(cloud?.pending||{}).length;
 const lastSuccess=cloud?.lastSuccessfulAt?new Date(cloud.lastSuccessfulAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'пока нет';
 const cloudDetails=signed?`Книг в облаке: ${cloud.remoteBooksCount||0} · Ожидают отправки: ${pendingCount} · Последняя успешная синхронизация: ${lastSuccess}`:'';
 openSheet('Облачная синхронизация',`<div class="prose"><p class="sync-state">${esc(cloud?.status||'Подключаем облако…')}</p>${signed?`<p class="small-copy muted">${esc(cloudDetails)}</p>`:''}${signed?`<p>Выполнен вход: ${esc(cloud.user.name)}</p>${import.meta.env.MODE==='pages'?'<button class="text-button" id="cloud-signout">Выйти из облака</button>':''}`:'<p>Войдите через ChatGPT на всех устройствах под одной учётной записью. Книги, настройки, закладки и место чтения будут доступны в вашем личном облаке.</p><a class="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Войти через ChatGPT</a>'}<p class="small-copy muted">Изменения сохраняются сначала на устройстве. Если сеть пропала, отправка повторится при подключении. Открытая страница не перескакивает из-за другого устройства.</p><button class="button secondary" id="sync-now">Синхронизировать сейчас</button>${remotePositions.length?'<h3>Места с других устройств</h3>':''}<div id="cloud-positions">${remotePositions.slice(0,20).map((r,i)=>{const b=books.find(b=>'position:'+b.id===r.key);return b?`<button class="chapter-row" data-remote="${i}"><span>${esc(b.title)}<small class="muted"> · ${new Date(r.clientUpdatedAt).toLocaleString('ru-RU')}</small></span></button>`:'';}).join('')}</div><p class="small-copy muted">Облако изолировано от ваших других приложений. Книги не доступны другим пользователям.</p></div>`);
 const signout=document.querySelector('#cloud-signout');if(signout)signout.onclick=async()=>{try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;cloud.user=null;cloud.setStatus('Войти для синхронизации');showCloud();}catch(e){message(e.message,true);}};
 document.querySelector('#sync-now').onclick=async()=>{const b=document.querySelector('#sync-now');b.disabled=true;await cloud?.sync();showCloud();};
 document.querySelectorAll('[data-remote]').forEach(el=>el.onclick=async()=>{const record=remotePositions[Number(el.dataset.remote)],book=books.find(b=>'position:'+b.id===record.key);if(!book)return;closeSheet();if(current?.id!==book.id)await openBook(book.id);jump(record.payload.anchor);});
}
async function init(){
 app.innerHTML='<div class="boot"><div class="brand">'+icon('book')+'<span>Книга.</span></div><p>Открываем библиотеку…</p></div>';
 try{
  settings=restoreSettings(await storage.getPreference('settings'));settingsUpdatedAt=await storage.getPreference('settings-updatedAt')||0;const storedSettings=await storage.getPreference('settings');globalSettings={...settings};if(storedSettings&&storedSettings.paragraphSpacingVersion!==1){settingsUpdatedAt=Date.now();await storage.setPreference('settings',settings);await storage.setPreference('settings-updatedAt',settingsUpdatedAt);}books=await storage.listBooks();
  if(!books.length){const response=await fetch(import.meta.env.BASE_URL+'sample.fb2');if(!response.ok)throw new Error('Не удалось загрузить демонстрационный фрагмент.');const original=await response.arrayBuffer();const demo=await importBook(original,'sample.fb2');const book={...demo,id:'sample',original,fileName:'sample.fb2',addedAt:Date.now(),marks:[]};await storage.putBook(book);books=[book];}
  for(const b of books){
    b.progress=await storage.getPreference(`position:${b.id}`);b.marks=b.progress?.marks||[];
    const appearance=await storage.getPreference(bookAppearanceKey(b.id));
    if(appearance?.settings){b.appearanceSettings=restoreSettings(appearance.settings);b.appearanceUpdatedAt=Number(appearance.updatedAt)||0;}
    else if(b.progress?.bookSettings){b.appearanceSettings=restoreSettings(b.progress.bookSettings);b.appearanceUpdatedAt=Number(b.progress.appearanceUpdatedAt||b.progress.updatedAt)||0;}
   }
  await library();
  cloud=new CloudSync({books:()=>books,addBook:b=>books.push(b),status:updateCloudStatus,libraryChanged:()=>{if(!current)library();},
   localAppearance:b=>b.appearanceSettings?{settings:b.appearanceSettings,updatedAt:b.appearanceUpdatedAt||0}:null,
   remoteAppearance:async(b,record,hasPending)=>{
    if(!preferRemoteAppearance(b.appearanceUpdatedAt,record.clientUpdatedAt,hasPending))return;
    const next=restoreSettings(record.payload),updatedAt=Number(record.clientUpdatedAt);
    await storage.setPreference(bookAppearanceKey(b.id),{settings:next,updatedAt});
    b.appearanceSettings=next;b.appearanceUpdatedAt=updatedAt;
    if(current?.id===b.id){const effective=resolveReadingAppearance({settings:globalSettings,updatedAt:settingsUpdatedAt},{settings:next,updatedAt});applyLiveAppearance(effective.settings);}
   },
   remoteSettings:async record=>{
    if(!preferRemoteAppearance(settingsUpdatedAt,record.clientUpdatedAt,Boolean(cloud?.pending.settings)))return;
    globalSettings=restoreSettings(record.payload);settingsUpdatedAt=Number(record.clientUpdatedAt);
    await storage.setPreference('settings',globalSettings);await storage.setPreference('settings-updatedAt',settingsUpdatedAt);
    const effective=resolveReadingAppearance({settings:globalSettings,updatedAt:settingsUpdatedAt},current?{settings:current.appearanceSettings,updatedAt:current.appearanceUpdatedAt||0}:null);
    applyLiveAppearance(effective.settings);
   },remotePosition:async(book,record,marks,annotations)=>{book.marks=marks;const p=record.payload;if(!p?.anchor||!Number.isInteger(p.anchor.block)||p.anchor.block<0||p.anchor.block>=book.blocks.length||!Number.isInteger(p.anchor.offset)||p.anchor.offset<0||p.anchor.offset>book.blocks[p.anchor.block].text.length)return;if(record.clientUpdatedAt>(book.progress?.updatedAt||0)&&current?.id!==book.id){book.progress={...p,marks,annotations,updatedAt:record.clientUpdatedAt};await storage.setPreference('position:'+book.id,book.progress);}const stored={...(book.progress||{anchor:{block:0,offset:0},updatedAt:0}),marks,annotations};book.progress=stored;await storage.setPreference('position:'+book.id,stored);if(current?.id===book.id)updateProgress();}});
  await cloud.init();
  if(import.meta.env.MODE==='pages')supabase.auth.onAuthStateChange(event=>{if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED'].includes(event))setTimeout(()=>cloud?.sync(),0);});
  if(settingsUpdatedAt&&!cloud.remote.some(r=>r.key==='settings'&&r.clientUpdatedAt>=settingsUpdatedAt))cloud.queue('settings',globalSettings,settingsUpdatedAt);
  for(const b of books)if(b.progress?.updatedAt&&!cloud.remote.some(r=>r.key==='position:'+b.id&&r.clientUpdatedAt>=b.progress.updatedAt))cloud.queue('position:'+b.id,b.progress,b.progress.updatedAt);
  setInterval(()=>{if(document.visibilityState==='visible')cloud.sync();},30000);window.addEventListener('online',()=>cloud.sync());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cloud.sync();});
 }catch(e){app.innerHTML=`<div class="startup-error"><h1>Библиотека недоступна</h1><p>${esc(e.message)}</p><button class="button primary" id="retry">Попробовать снова</button></div>`;document.querySelector('#retry').onclick=init;}
 if('serviceWorker' in navigator&&import.meta.env.PROD)navigator.serviceWorker.register(import.meta.env.MODE==='pages'?import.meta.env.BASE_URL+'sw.js':'/sw.js').catch(()=>message('Офлайн-режим не включился. Сохранение книг работает, но для открытия приложения понадобится сеть.',true));
}
init();
