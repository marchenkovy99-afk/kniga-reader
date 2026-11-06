import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
import {epubFixture} from './support/epub-fixture';
const text='Текст сноски: <img src=x onerror=alert(1)> остаётся текстом.';
const fb2='<FictionBook xmlns:l="http://www.w3.org/1999/xlink"><description><title-info><book-title>Сноски</book-title></title-info></description><body><section><p>Слово<a type="note" l:href="#n1"><sup>1</sup></a> и продолжение.</p>'+('<p>'+'Обычный текст книги. '.repeat(3)+'Конец.</p>').repeat(20)+'</section></body><body name="notes"><section id="n1"><title><p>1</p></title><p>'+text.replaceAll('<','&lt;').replaceAll('>','&gt;')+'</p></section></body></FictionBook>';
async function open(page,format){
 await page.goto('/');
 let buffer=Buffer.from(fb2);
 if(format==='epub'){
  const zip=await JSZip.loadAsync(epubFixture(false,'Footnotes EPUB',12));
  const chapter=await zip.file('OEBPS/one.xhtml')!.async('string');
  zip.file('OEBPS/one.xhtml',chapter.replace('<p>Passage 0','<p id="epub-note"><sup><a href="notes.xhtml#epub-note">1</a></sup> Passage 0'));
  zip.file('OEBPS/notes.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Notes</title></head><body><aside id="epub-note">EPUB сноска без перехода</aside></body></html>');
  const opf=await zip.file('OEBPS/content.opf')!.async('string');
  zip.file('OEBPS/content.opf',opf.replace('</manifest>','<item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/></manifest>'));
  buffer=await zip.generateAsync({type:'nodebuffer'});
 }
 await page.locator('input[type=file]').first().setInputFiles({name:'notes.'+format,mimeType:format==='fb2'?'text/xml':'application/epub+zip',buffer});
 await page.locator('.continue-card').click();
 await expect(page.locator(format==='fb2'?'.book-flow':'.epub-mount iframe')).toBeVisible();

}
for(const format of ['fb2','epub'])test(format+': footnote opens on a real touch, stays on the same page, closes by Escape and works offline',async({page,context})=>{
 await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',r=>r.abort());
 await open(page,format);
 await expect(page.locator('.reading-status')).toContainText(/\d+ \/ \d+/);
 const position=async()=> (await page.locator('.reading-status').textContent()).match(/(\d+) \//)[1];
 const before=await position();
 const note=format==='fb2'?page.locator('.book-flow [data-note]').first():page.frameLocator('.epub-mount iframe').locator('a').first();
 const box=await note.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
 const dialog=page.getByRole('dialog',{name:'Сноска',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog).toContainText(format==='fb2'?text:'EPUB сноска без перехода');
 await expect(dialog.locator('img,script,iframe')).toHaveCount(0);
 expect(await position()).toBe(before);
 const backdrop=await dialog.evaluate(el=>getComputedStyle(el).backdropFilter);expect(backdrop).not.toBe('none');
 await dialog.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
 await page.screenshot({path:'test-results/footnote-'+format+'.png'});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 expect(await position()).toBe(before);
 await context.setOffline(true);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Закрыть сноску'}).click();await expect(dialog).toHaveCount(0);
 expect(await position()).toBe(before);
});

const complete16=['От Рождества Христова (лат.).','Продолжение пояснения 16. '.repeat(320).trim(),'Последний абзац. END_NOTE_16'];
for(const format of ['fb2','epub'])test(format+': numbered heading resolves the exact complete note, not its marker or adjacent notes',async({page,context})=>{
 await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',r=>r.abort());
 const paragraphs=complete16.map(t=>'<p>'+t+'</p>').join('');
 const main='<p>Первый термин <a xmlns:l="http://www.w3.org/1999/xlink" l:href="#n13" href="notes.xhtml#n13"><sup>[13]</sup></a>. Anno domini <a xmlns:l="http://www.w3.org/1999/xlink" l:href="#n16" href="notes.xhtml#n16"><sup>[16]</sup></a>.</p>';
 let buffer:Buffer;
 if(format==='fb2')buffer=Buffer.from('<FictionBook><description><title-info><book-title>Полные примечания</book-title></title-info></description><body><section>'+main+'</section></body><body name="notes"><section id="n13"><title><p>13</p></title><p>Пояснение 13.</p></section><section><title><p id="n16">16</p></title>'+paragraphs+'</section><section id="n17"><title><p>17</p></title><p>ЧУЖАЯ СНОСКА 17.</p></section></body></FictionBook>');
 else{
  const zip=await JSZip.loadAsync(epubFixture(false,'Полные примечания EPUB',4));
  const chapter=await zip.file('OEBPS/one.xhtml')!.async('string');zip.file('OEBPS/one.xhtml',chapter.replace('<p>Passage 0',main+'<p>Passage 0'));
  zip.file('OEBPS/notes.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Примечания</title></head><body><h3><a id="n13">13</a></h3><p>Пояснение 13.</p><h3><a id="n16"></a>16</h3>'+paragraphs+'<h3><a id="n17"></a>17</h3><p>ЧУЖАЯ СНОСКА 17.</p></body></html>');
  const opf=await zip.file('OEBPS/content.opf')!.async('string');zip.file('OEBPS/content.opf',opf.replace('</manifest>','<item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/></manifest>'));buffer=await zip.generateAsync({type:'nodebuffer'});
 }
 await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'complete-notes.'+format,mimeType:format==='fb2'?'text/xml':'application/epub+zip',buffer});await page.locator('.continue-card').click();
 const link=(label:string)=>format==='fb2'?page.locator('.book-flow [data-note]').filter({hasText:label}).first():page.frameLocator('.epub-mount iframe').locator('a').filter({hasText:label}).first();
 const tap=async(label:string)=>{const box=await link(label).boundingBox();expect(box).not.toBeNull();await page.touchscreen.tap(box!.x+box!.width/2,box!.y+box!.height/2)};
 const dialog=page.getByRole('dialog',{name:'Сноска',exact:true}),text=dialog.locator('.libra-note-text');
 await tap('[13]');await expect(text).toHaveText('Пояснение 13.');await dialog.getByRole('button',{name:'Закрыть сноску'}).click();
 const position=()=>page.locator('.reading-status').evaluate(el=>(el.textContent||'').match(/(\d+) \//)?.[1]);const before=await position();
 await tap('[16]');await expect(text).toHaveText(complete16.join('\n\n'));expect(await text.textContent()).toBe(complete16.join('\n\n'));await expect(text).not.toContainText('ЧУЖАЯ СНОСКА');
 const card=dialog;await card.evaluate(el=>{el.scrollTop=el.scrollHeight});
 expect(await text.evaluate(el=>{const node=el.firstChild!;const range=document.createRange();range.setStart(node,node.textContent!.length-11);range.setEnd(node,node.textContent!.length);const last=range.getBoundingClientRect(),card=el.closest('[role="dialog"]')!.getBoundingClientRect();return last.bottom<=card.bottom&&last.top>=card.top})).toBe(true);
 await dialog.getByRole('button',{name:'Закрыть сноску'}).click();expect(await position()).toBe(before);
 await context.setOffline(true);await tap('[16]');await expect(text).toHaveText(complete16.join('\n\n'));expect(await text.textContent()).toBe(complete16.join('\n\n'));
});
