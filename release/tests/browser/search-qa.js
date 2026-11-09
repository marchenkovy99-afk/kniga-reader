const out=document.querySelector('#qa-output'),results=[],params=new URLSearchParams(location.search);document.documentElement.dataset.qaWidth=params.get('width')||'390';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timeout: '+String(fn));await pause(30)}return fn()}
function assert(ok,text){results.push({pass:!!ok,text});out.textContent=JSON.stringify({status:'RUNNING',results},null,2);if(!ok)throw Error(text);}
const errors=[];window.addEventListener('error',e=>errors.push(e.error?.stack||e.message));window.addEventListener('unhandledrejection',e=>errors.push(e.reason?.stack||String(e.reason)));
const findButton=name=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===name||b.textContent.trim()===name);
const input=query=>{const field=document.querySelector('.book-search-field input');field.value=query;field.dispatchEvent(new Event('input',{bubbles:true}));};
const source=()=>document.querySelector('.reading-content .page-viewport')?.libraFb2Preview||document.querySelector('.reading-content .epub-mount')?.libraEpubPreview;
const phrase='<p>Руко<em>писи</em> не горят. Это предложение для поиска.</p>',prose='<p>'+('Тихий вечер опустился на город. Читатель перевернул страницу. '.repeat(12))+'</p>';
const fb2=`<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Проверка поиска FB2</book-title><author><first-name>Тест</first-name></author></title-info></description><body><section><title><p>Первая глава</p></title>${prose.repeat(7)}${phrase}${prose.repeat(5)}<table><tr><td>ИскраТаблицы</td><td>Вторая ячейка</td></tr></table></section><section><title><p>Вторая глава</p></title>${prose.repeat(3)}${phrase}${prose.repeat(3)}</section></body></FictionBook>`;
async function importBook(format){
 await until(()=>document.querySelector('input[type=file]'));
 const existing=new Set([...document.querySelectorAll('[data-library-book]')].map(n=>n.dataset.libraryBook));
 const bytes=format==='fb2'?fb2:await(await fetch('/search-fixture.epub')).arrayBuffer();const dt=new DataTransfer();dt.items.add(new File([bytes],`search.${format}`,{type:format==='fb2'?'application/xml':'application/epub+zip'}));const file=document.querySelector('input[type=file]');file.files=dt.files;file.dispatchEvent(new Event('change',{bubbles:true}));const tile=await until(()=>[...document.querySelectorAll('[data-library-book]')].find(n=>!existing.has(n.dataset.libraryBook)&&n.textContent.includes(format==='epub'?'EPUB':'FB2')));tile.querySelector('.book-tile-open').click();await until(()=>source()?.position?.()&&(format==='epub'?source().position().cfi:source().settled?.()));await pause(500);
}
try{
 const format=params.get('format')||'fb2';await importBook(format);
 if(params.get('theme')){document.querySelector('.reading-status').click();findButton('Текст').click();await until(()=>document.querySelector(`.theme-swatch[data-option="${params.get('theme')}"]`));document.querySelector(`.theme-swatch[data-option="${params.get('theme')}"]`).click();document.querySelector('.sheet-scrim:not(.sheet-exiting) [aria-label="Закрыть"]').click();await pause(400);}
 const initial=source().position();
 if(!document.querySelector('.reading-bottom.visible'))document.querySelector('.reading-status').click();await until(()=>findButton('Поиск по книге'));findButton('Поиск по книге').click();await until(()=>document.querySelector('.book-search-panel'));
 const panel=document.querySelector('.book-search-panel'),root=document.querySelector('.reading-root');
 assert(getComputedStyle(panel).backgroundColor===getComputedStyle(root).backgroundColor,format+': panel uses current reader background');
 input('РУКОПИСИ не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);
 assert(document.querySelectorAll('.book-search-result mark').length===2,format+': phrase crosses inline emphasis and ignores case');
 assert(!document.querySelector('.book-search-panel').getBoundingClientRect().right||document.querySelector('.book-search-panel').getBoundingClientRect().right<=root.getBoundingClientRect().right+1,format+': search fits reader width');
 if(params.get('scene')==='results'){out.textContent=JSON.stringify({status:'SCENE',results},null,2);throw {scene:true};}
 document.querySelectorAll('.book-search-result')[1].click();await until(()=>document.querySelector('.book-search-nav output')?.textContent==='2 / 2');
 assert(source().position().chapter===1,format+': selected result navigates to chapter two');assert(source().position().page>0,format+': selected result navigates to an interior physical page');
 assert(document.querySelectorAll('[data-search-highlight] i').length>0,format+': visible text is highlighted without text DOM mutation');
 const nav=document.querySelector('.book-search-nav').getBoundingClientRect(),view=document.querySelector('.reading-content .page-viewport,.reading-content .epub-mount').getBoundingClientRect();assert(view.bottom<=nav.top+2,format+': navigation does not cover prose');
 if(params.get('scene')==='hit'){out.textContent=JSON.stringify({status:'SCENE',results},null,2);throw {scene:true};}
 findButton('Показать результаты поиска').click();await until(()=>document.querySelectorAll('.book-search-result').length===2);input('другой запрос');await until(()=>document.querySelector('.book-search-count')?.textContent==='Ничего не найдено');findButton('Закрыть поиск').click();assert(document.querySelector('.book-search-nav output')?.textContent==='2 / 2',format+': closing an edited query preserves active navigation');
 findButton('Предыдущее совпадение').click();await until(()=>document.querySelector('.book-search-nav output')?.textContent==='1 / 2');assert(source().position().chapter===0,format+': previous match returns to chapter one');
 findButton('Вернуться к чтению').click();await until(()=>{const returned=source().position();return !document.querySelector('.book-search-nav')&&returned.chapter===initial.chapter&&(format==='epub'?returned.cfi===initial.cfi:returned.page===initial.page);});assert(true,format+': return restores original position');
 if(!document.querySelector('.reading-bottom.visible'))document.querySelector('.reading-status').click();findButton('Поиск по книге').click();input('неттакогослова');await until(()=>document.querySelector('.book-search-count')?.textContent==='Ничего не найдено');assert(document.querySelectorAll('.book-search-result').length===0,format+': empty results');
 input('Это предложение для поиска.');await until(()=>document.querySelectorAll('.book-search-result').length===2);assert(true,format+': full-sentence search');
 input('неттакогослова');input('рукописи не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);assert(true,format+': rapid query replacement cancels stale work');
 input('');await until(()=>document.querySelector('.book-search-results')?.textContent==='Слово, фраза или целое предложение');assert(true,format+': empty query');findButton('Закрыть поиск').click();await until(()=>!document.querySelector('.book-search-panel'));assert(!document.querySelector('.reading-bottom[inert]')&&!findButton('Поиск по книге').disabled,format+': closing restores access to reader controls');
 assert(errors.length===0,format+': no runtime errors '+errors.join('; '));out.textContent=JSON.stringify({status:'PASS',results},null,2);document.title='PASS: Libra search QA';
}catch(error){if(!error.scene){out.textContent=JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,results,errors},null,2);document.title='FAIL: Libra search QA';}}
