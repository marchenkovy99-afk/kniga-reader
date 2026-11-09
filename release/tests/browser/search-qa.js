const out=document.querySelector('#qa-output'),results=[],params=new URLSearchParams(location.search);document.documentElement.dataset.qaWidth=params.get('width')||'390';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=45000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timeout: '+String(fn));await pause(30)}return fn()}
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
function visiblePhrase(){
 const mount=document.querySelector('.reading-content .page-viewport,.reading-content .epub-mount');if(!mount)return false;
 const view=mount.getBoundingClientRect(),docs=mount.classList.contains('epub-mount')?[...mount.querySelectorAll('iframe')].map(f=>({doc:f.contentDocument,box:f.getBoundingClientRect()})):[{doc:mount,box:{left:0,top:0}}];
 for(const {doc,box}of docs){for(const p of doc?.querySelectorAll('p')||[]){if(!p.textContent.startsWith('Рукописи не горят.'))continue;const walker=(p.ownerDocument).createTreeWalker(p,4),node=walker.nextNode();if(!node)continue;const range=p.ownerDocument.createRange();range.setStart(node,0);range.setEnd(node,Math.min(4,node.length));for(const rect of range.getClientRects()){const x=rect.left+box.left,y=rect.top+box.top;if(rect.width>0&&rect.height>0&&x>=view.left-1&&x<view.right&&y>=view.top-1&&y<view.bottom)return true;}}}
 return false;
}
async function engineStable(){
 let since=0,last='';await until(()=>{const api=source(),view=document.querySelector('.reading-content .page-viewport,.reading-content .epub-mount');if(!api||!view||api.settled?.()===false||document.querySelector('.reading-root')?.dataset.searchNavigating)return since=0;const state=api.state(),geometry=state.geometry||state,key=state.key+':'+view.clientHeight+':'+view.clientWidth;if(geometry.height!==undefined&&Math.abs(geometry.height-view.clientHeight)>1||geometry.width!==undefined&&Math.abs(geometry.width-view.clientWidth)>1||document.querySelector('.book-search-nav')&&findButton('Завершить поиск')?.disabled){since=0;return false;}if(last!==key){last=key;since=0;}if(!since)since=performance.now();return performance.now()-since>700;});
}
async function stress(format){
 const click=async name=>{const button=await until(()=>{const b=findButton(name);return b&&!b.disabled?b:null;});button.click();};
 for(let cycle=0;cycle<20;cycle++){
  const origin=source().position();
  if(!document.querySelector('.reading-bottom.visible'))document.querySelector('.reading-status').click();
  await click('Поиск по книге');input('рукописи не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);
  input('не существует');assert(document.querySelectorAll('.book-search-result').length===0,format+': stale results removed '+cycle);
  input('рукописи не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);
  const hit=cycle%2;document.querySelectorAll('.book-search-result')[hit].click();await until(()=>document.querySelector('.book-search-nav output')?.textContent===`${hit+1} / 2`&&!findButton('Завершить поиск')?.disabled);
  assert(source().position().chapter===hit&&visiblePhrase(),format+': exact visible match '+cycle);
  document.querySelector('.reading-root').style.height=(cycle%2?690:750)+'px';
  await engineStable();await until(visiblePhrase);await pause(350);
  assert(visiblePhrase(),format+': match survives late viewport resize '+cycle);
  if(cycle%2===0){
   await click('Вернуться к исходному месту');await until(()=>!document.querySelector('.book-search-nav'));await engineStable();
   assert(source().position().chapter===origin.chapter,format+': explicit Return '+cycle);
  }else{
   await click('Завершить поиск');await until(()=>!document.querySelector('.book-search-nav'));await engineStable();await pause(2000);
   assert(source().position().chapter===hit&&visiblePhrase(),format+': Close preserves exact text after two seconds '+cycle);
   const bookId=document.querySelector('.reading-root').dataset.bookId;await click('В библиотеку');await until(()=>!source());document.querySelector(`[data-library-book="${bookId}"] .book-tile-open`).click();await until(()=>source()?.position?.()?.chapter===hit&&source().settled?.()!==false);await pause(500);
   assert(visiblePhrase(),format+': reopened book shows found text '+cycle);
  }
 }
 assert(errors.length===0,format+': no runtime errors');out.textContent=JSON.stringify({status:'PASS',cycles:20,format,results},null,2);document.title='PASS: 20 search cycles '+format;
}
try{
 const format=params.get('format')||'fb2';await importBook(format);if(params.has('stress')){await stress(format);throw {scene:true};}
 if(params.get('theme')){document.querySelector('.reading-status').click();findButton('Текст').click();await until(()=>document.querySelector(`.theme-swatch[data-option="${params.get('theme')}"]`));document.querySelector(`.theme-swatch[data-option="${params.get('theme')}"]`).click();document.querySelector('.sheet-scrim:not(.sheet-exiting) [aria-label="Закрыть"]').click();await pause(400);}
 const initial=source().position();
 if(!document.querySelector('.reading-bottom.visible'))document.querySelector('.reading-status').click();await until(()=>findButton('Поиск по книге'));findButton('Поиск по книге').click();await until(()=>document.querySelector('.book-search-panel'));
 const panel=document.querySelector('.book-search-panel'),root=document.querySelector('.reading-root');
 assert(getComputedStyle(panel).backgroundColor===getComputedStyle(root).backgroundColor,format+': panel uses current reader background');
 input('РУКОПИСИ не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);
 assert(document.querySelectorAll('.book-search-result mark').length===2,format+': phrase crosses inline emphasis and ignores case');
 assert(!document.querySelector('.book-search-panel').getBoundingClientRect().right||document.querySelector('.book-search-panel').getBoundingClientRect().right<=root.getBoundingClientRect().right+1,format+': search fits reader width');
 if(params.get('scene')==='results'){out.textContent=JSON.stringify({status:'SCENE',results},null,2);throw {scene:true};}
 const hitNumber=params.get('stay')==='same'?1:2;document.querySelectorAll('.book-search-result')[hitNumber-1].click();await until(()=>document.querySelector('.book-search-nav output')?.textContent===`${hitNumber} / 2`);
 assert(source().position().chapter===hitNumber-1,format+': selected result navigates to its chapter');assert(source().position().page>0,format+': selected result navigates to an interior physical page');
 assert(document.querySelectorAll('[data-search-highlight] i').length>0,format+': visible text is highlighted without text DOM mutation');
 const nav=document.querySelector('.book-search-nav').getBoundingClientRect(),view=document.querySelector('.reading-content .page-viewport,.reading-content .epub-mount').getBoundingClientRect();assert(view.bottom<=nav.top+2,format+': navigation does not cover prose');
 if(params.has('stay')){
  const selected=source().position();findButton('Завершить поиск').click();await until(()=>!document.querySelector('.book-search-nav'));await pause(1200);
  await until(()=>source().position().chapter===selected.chapter&&(format==='epub'?source().position().cfi!==initial.cfi:source().settled()));
  assert(source().position().chapter===selected.chapter&&source().position().page>0,format+': Close stays at the found place, not the initial page');
  const saved=source().position(),bookId=document.querySelector('.reading-root').dataset.bookId;
  findButton('В библиотеку').click();await until(()=>!source());document.querySelector(`[data-library-book="${bookId}"] .book-tile-open`).click();await until(()=>source()?.position?.()?.chapter===saved.chapter);await pause(500);
  assert(source().position().chapter===saved.chapter&&source().position().page>0,format+': reopening preserves found position after closing search');
  assert(errors.length===0,format+': no runtime errors '+errors.join('; '));out.textContent=JSON.stringify({status:'PASS',results},null,2);document.title='PASS: Libra search stays';throw {scene:true};
 }
 if(params.get('scene')==='hit'){out.textContent=JSON.stringify({status:'SCENE',results},null,2);throw {scene:true};}
 findButton('Показать результаты поиска').click();await until(()=>document.querySelectorAll('.book-search-result').length===2);input('другой запрос');await until(()=>document.querySelector('.book-search-count')?.textContent==='Ничего не найдено');findButton('Закрыть поиск').click();assert(document.querySelector('.book-search-nav output')?.textContent==='2 / 2',format+': closing an edited query preserves active navigation');
 findButton('Предыдущее совпадение').click();await until(()=>document.querySelector('.book-search-nav output')?.textContent==='1 / 2');assert(source().position().chapter===0,format+': previous match returns to chapter one');
 findButton('Вернуться к исходному месту').click();await until(()=>{const returned=source().position();return !document.querySelector('.book-search-nav')&&returned.chapter===initial.chapter&&(format==='epub'?returned.cfi===initial.cfi:returned.page===initial.page);});assert(true,format+': return restores original position');
 if(!document.querySelector('.reading-bottom.visible'))document.querySelector('.reading-status').click();findButton('Поиск по книге').click();input('неттакогослова');await until(()=>document.querySelector('.book-search-count')?.textContent==='Ничего не найдено');assert(document.querySelectorAll('.book-search-result').length===0,format+': empty results');
 input('Это предложение для поиска.');await until(()=>document.querySelectorAll('.book-search-result').length===2);assert(true,format+': full-sentence search');
 input('неттакогослова');input('рукописи не горят');await until(()=>document.querySelectorAll('.book-search-result').length===2);assert(true,format+': rapid query replacement cancels stale work');
 input('');await until(()=>document.querySelector('.book-search-results')?.textContent==='Слово, фраза или целое предложение');assert(true,format+': empty query');findButton('Закрыть поиск').click();await until(()=>!document.querySelector('.book-search-panel'));assert(!document.querySelector('.reading-bottom[inert]')&&!findButton('Поиск по книге').disabled,format+': closing restores access to reader controls');
 assert(errors.length===0,format+': no runtime errors '+errors.join('; '));out.textContent=JSON.stringify({status:'PASS',results},null,2);document.title='PASS: Libra search QA';
}catch(error){if(!error.scene){out.textContent=JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,results,errors},null,2);document.title='FAIL: Libra search QA';}}
