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
