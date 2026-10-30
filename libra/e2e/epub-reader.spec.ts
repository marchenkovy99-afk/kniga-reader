import {test,expect} from '@playwright/test';

/** Stored ZIP writer: minimum EPUB2 fixture, no external services or fixtures. */
export function epubFixture(complex=false,title='EPUB fixture',paragraphCount=140,clipped=false):Buffer{
 const chapterParagraphs=Array.from({length:paragraphCount},(_,i)=>
  '<p'+(clipped&&i===0?' style="height:10px;overflow:hidden"':'')+'>Passage '+i+' '+('The complete book remains visible after typography changes. '.repeat(7))+'</p>').join('');
 const files=[
  ['mimetype','application/epub+zip'],
  ['META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
  ['OEBPS/content.opf','<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>EPUB fixture</dc:title><dc:identifier id="uid">urn:uuid:aa-bb-cc</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/></spine></package>'],
  ['OEBPS/toc.ncx','<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:aa-bb-cc"/></head><docTitle><text>EPUB fixture</text></docTitle><navMap><navPoint id="one" playOrder="1"><navLabel><text>Opening</text></navLabel><content src="one.xhtml"/></navPoint></navMap></ncx>'],
  ['OEBPS/one.xhtml','<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Opening</title></head><body><h1>FIRST CHAPTER</h1>'+chapterParagraphs+'<p>END OF BOOK</p></body></html>']
 ];

 if(complex){
  const opf=files.find(x=>x[0]==='OEBPS/content.opf')!;
  opf[1]=opf[1]
   .replace('</manifest>','<item id="c2" href="second.xhtml" media-type="application/xhtml+xml"/></manifest>')
   .replace('</spine>','<itemref idref="c2"/></spine>');
  const ncx=files.find(x=>x[0]==='OEBPS/toc.ncx')!;
  ncx[1]=ncx[1].replace('</navMap>','<navPoint id="two" playOrder="2"><navLabel><text>Вторая глава</text></navLabel><content src="second.xhtml"/></navPoint></navMap>');
  const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==';
  files.push(['OEBPS/second.xhtml',
   '<?xml version="1.0" encoding="UTF-8"?>'+
   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Вторая глава</title></head><body>'+
   '<h1>SECOND CHAPTER</h1>'+
   '<p>Тестируем изображения и широкую таблицу, сохранение всех символов.</p>'+
   '<table><tbody><tr><td>LEFT CELL</td><td>EXTREMELY_LONG_UNBREAKABLE_CELL_VALUE_123456789_987654321</td></tr></tbody></table>'+
   '<p><img alt="Тестовая иллюстрация" src="data:image/png;base64,'+pixel+'"/></p>'+
   '<p>END OF SECOND CHAPTER</p></body></html>']);
 }
 for(const file of files)file[1]=file[1].replaceAll('EPUB fixture',title);
 const crc32=(buffer:Buffer)=>{
  let crc=0xffffffff;
  for(const b of buffer){
   crc^=b;
   for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
 };
 const chunks:Buffer[]=[];const central:Buffer[]=[];let offset=0;
 for(const [path,text] of files){
  const name=Buffer.from(path,'utf8'),body=Buffer.from(text,'utf8');
  const crc=crc32(body);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);
  local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
  chunks.push(local,name,body);
  const entry=Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);
  entry.writeUInt16LE(20,6);entry.writeUInt32LE(crc,16);
  entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(body.length,24);
  entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  central.push(entry,name);
  offset+=local.length+name.length+body.length;
 }
 const centralSize=central.reduce((total,part)=>total+part.length,0);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);
 end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);
 end.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,...central,end]);
}

test('real EPUB stays readable across font, margin and palette adjustments',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'lifecycle.epub',mimeType:'application/epub+zip',buffer:epubFixture()
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible({timeout:15000});
 const chapter=page.frameLocator('.epub-mount iframe');
 await expect(chapter.locator('body')).toContainText('Passage 0');
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').first().fill('24');
 await page.locator('.sheet-settings input[type=range]').nth(2).fill('28');
 await page.locator('.theme-swatch[data-option=oled]').click();
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await expect(chapter.locator('body')).toContainText('Passage 0');
 const palette=await page.locator('.reading-root').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(palette).toBe('rgb(0, 0, 0)');
 await page.locator('.reading-zones').click({position:{x:340,y:240}});
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await expect(page.locator('.app-error')).toHaveCount(0);
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible({timeout:15000});
 await expect(page.locator('.app-error')).toHaveCount(0);
});

test('EPUB2 NCX navigation opens later chapter with wide table and inline image',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'complex.epub',mimeType:'application/epub+zip',buffer:epubFixture(true)
 });
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible({timeout:15000});
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Оглавление'}).click();
 await expect(page.locator('.chapter-menu button')).toHaveCount(2);
 await page.getByRole('button',{name:'Вторая глава'}).click();
 const frame=page.frameLocator('.epub-mount iframe');
 await expect(frame.locator('body')).toContainText('SECOND CHAPTER',{timeout:15000});
 await expect(frame.locator('body')).toContainText('EXTREMELY_LONG_UNBREAKABLE_CELL_VALUE');
 const measure=await frame.locator('body').evaluate(el=>{
   const table=el.querySelector('table'),image=el.querySelector('img');
   const pageWidth=el.clientWidth;
   return {tableWidth:table?.getBoundingClientRect().width||0,
    imageWidth:image?.getBoundingClientRect().width||0,pageWidth};
 });
 expect(measure.pageWidth).toBeGreaterThan(200);
 expect(measure.tableWidth).toBeLessThanOrEqual(measure.pageWidth+2);
 expect(measure.imageWidth).toBeLessThanOrEqual(measure.pageWidth+2);
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 if(!await page.locator('.reading-bottom').evaluate(el=>el.classList.contains('visible'))){
  await page.locator('.reading-zones').click({position:{x:190,y:240}});
 }
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').nth(2).fill('32');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect(frame.locator('body')).toContainText('SECOND CHAPTER');
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.locator('.continue-card').click();
 await expect(page.frameLocator('.epub-mount iframe').locator('body')).toContainText('SECOND CHAPTER',{timeout:15000});
});

test('library sorting orders imported books and displays progress metadata',async({page})=>{
 await page.goto('/');
 for(const name of ['Z-last.epub','A-first.epub']){
  await page.locator('input[type=file]').setInputFiles({name,mimeType:'application/epub+zip',buffer:epubFixture(false,name)});
  await expect(page.locator('.book-tile')).toHaveCount(name.startsWith('Z')?1:2);
 }
 const option=page.getByLabel('Сортировка книг');
 await option.selectOption('title');
 await expect(page.locator('.book-tile-open strong').first()).toContainText('A-first');
 await expect(page.locator('.book-tile-meta')).toHaveCount(2);
 await expect(page.locator('.book-tile-meta').first()).toContainText('EPUB');
});


test('EPUB final source paragraph is reachable after font and margin reflow',async({page})=>{
 test.setTimeout(145000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'complete-book.epub',mimeType:'application/epub+zip',
  buffer:epubFixture(false,'EPUB full-content test',12)
 });
 await page.locator('.continue-card').click();
 const frame=page.frameLocator('.epub-mount iframe');
 await expect(frame.locator('body')).toContainText('Passage 0',{timeout:15000});
 await expect(frame.locator('body')).toContainText('END OF BOOK');
 const before=await frame.locator('body').innerText();
 await page.locator('.reading-zones').click({position:{x:195,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 const sliders=page.locator('.sheet-settings input[type=range]');
 await sliders.nth(0).fill('26');
 await sliders.nth(1).fill('1.8');
 await sliders.nth(2).fill('30');
 await sliders.nth(8).fill('30');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect(frame.locator('body')).toContainText('END OF BOOK');
 expect(await frame.locator('body').innerText()).toBe(before);
 const outer=page.locator('.epub-mount iframe');
 const mount=page.locator('.epub-mount');
 let accessible=false;
 for(let i=0;i<100;i++){
  const inner=await frame.locator('body > p:last-of-type').evaluate(el=>{
   const rect=el.getBoundingClientRect();
   return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};
  });
  const [iframeBox,mountBox]=await Promise.all([
   outer.boundingBox(),mount.boundingBox()
  ]);
  if(iframeBox&&mountBox){
   const left=iframeBox.x+inner.left,right=iframeBox.x+inner.right;
   const top=iframeBox.y+inner.top,bottom=iframeBox.y+inner.bottom;
   if(inner.width>0&&inner.height>0&&left>=mountBox.x-3&&right<=mountBox.x+mountBox.width+3&&
     top>=mountBox.y-3&&bottom<=mountBox.y+mountBox.height+3){
    accessible=true;break;
   }
  }
  await page.locator('.reading-zones').click({position:{x:345,y:350}});
  await page.waitForTimeout(70);
 }
 expect(accessible,'EPUB terminal paragraph is not reachable within the visible page after reflow').toBe(true);
 expect(await frame.locator('body').innerText()).toBe(before);
 await page.reload();
 await page.locator('.continue-card').click();
 await expect(page.frameLocator('.epub-mount iframe').locator('body')).toContainText('END OF BOOK',{timeout:15000});
 await expect(page.locator('.app-error')).toHaveCount(0);
});

test('EPUB slider reaches final glyph and persists progress without rounded keyboard stalls',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'seek.epub',mimeType:'application/epub+zip',buffer:epubFixture(false,'EPUB seeking',40)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});
 await expect(slider).toBeEnabled();
 await slider.press('Home');
 await expect(slider).toHaveValue('1');
 for(const target of [2,3,4]){
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(target));
 }
 await page.getByRole('button',{name:'Текст',exact:true}).click();
 await page.getByRole('slider',{name:/Размер текста/}).press('End');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await slider.press('End');
 await expect(page.locator('.reading-progress strong')).toHaveText('100%');
 await expect.poll(()=>page.locator('.epub-mount').evaluate(host=>{
  const iframe=host.querySelector('iframe')!;
  const body=iframe.contentDocument?.body;
  const last=body?.querySelector('p:last-child');
  if(!last?.firstChild)return false;
  const range=iframe.contentDocument!.createRange();
  range.setStart(last.firstChild,Math.max(0,last.firstChild.textContent!.length-1));
  range.setEnd(last.firstChild,last.firstChild.textContent!.length);
  const glyph=range.getBoundingClientRect(),frame=iframe.getBoundingClientRect(),vp=host.getBoundingClientRect();
  return glyph.left+frame.left>=vp.left-2&&glyph.right+frame.left<=vp.right+2&&glyph.top+frame.top>=vp.top-2&&glyph.bottom+frame.top<=vp.bottom+2;
 })).toBe(true);
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await expect(page.locator('.book-tile-meta')).toContainText('100% прочитано');
 await page.reload();await page.locator('.continue-card').click();
 await expect(page.getByRole('button',{name:'Показать управление чтением'})).toContainText('100%');
});

test('EPUB uses a distinct page number per turn and keeps zero-margin frame static',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'physical.epub',mimeType:'application/epub+zip',buffer:epubFixture(false,'Physical pages',24)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await page.getByRole('button',{name:'Текст',exact:true}).click();
 await page.getByRole('slider',{name:/Размер текста/}).fill('30');
 for(const label of ['Поле слева','Поле справа','Поле сверху','Поле снизу']){
  await page.getByRole('slider',{name:new RegExp(label)}).fill('0');
 }
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});
 await expect(slider).toBeEnabled();await slider.press('Home');
 await expect(slider).toHaveValue('1');
 await page.getByRole('button',{name:'Скрыть управление чтением'}).click();
 const fixed=await page.locator('.epub-mount').boundingBox();expect(fixed).toBeTruthy();
 for(let expected=2;expected<=9;expected++){
  await page.locator('.reading-zones').click({position:{x:345,y:350}});
  await expect(page.locator('.reading-status')).toContainText(`${expected} /`);
  expect(await page.locator('.epub-mount').boundingBox()).toEqual(fixed);
  await expect(page.getByRole('alert')).toHaveCount(0);
 }
});


test('EPUB clipped source block triggers recovery that exposes its full text',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'inner-clip.epub',mimeType:'application/epub+zip',buffer:epubFixture(false,'Clipped block',12,true)});
 await page.locator('.continue-card').click();
 const body=page.frameLocator('.epub-mount iframe').locator('body');
 await expect(body).toContainText('Passage 0');
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await expect(page.locator('.reading-root')).toHaveClass(/reading-scroll-safe/);
 await expect.poll(()=>body.locator('p').first().evaluate(el=>getComputedStyle(el).overflow)).toBe('visible');
 expect(await body.locator('p').first().evaluate(el=>el.scrollHeight<=el.clientHeight+2)).toBe(true);
 await expect(body).toContainText('END OF BOOK');
});
