import {test,expect} from '@playwright/test';
import {epubFixture} from './support/epub-fixture';

const fb2='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Цитатник</book-title></title-info></description><body><section><title><p>Начало</p></title>'+Array.from({length:30},(_,i)=>'<p>Фрагмент '+i+'. '+('Важные слова сохраняются без обрезки. '.repeat(10))+'</p>').join('')+'</section></body></FictionBook>';

test('FB2 quote action selects text without intercepting book gestures, saves and returns to source',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'quote.fb2',mimeType:'application/xml',buffer:Buffer.from(fb2)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await page.getByRole('button',{name:'Цитата',exact:true}).click();
 await expect(page.locator('.reading-root')).toHaveClass(/reading-quote-mode/);
 await page.locator('.book-paragraph').first().evaluate(el=>{
  const text=el.firstChild as Text,r=document.createRange();
  r.setStart(text,0);r.setEnd(text,Math.min(25,text.length));
  const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
 });
 await expect(page.getByRole('group',{name:'Действия с выделенной цитатой'})).toBeVisible();
 await page.getByRole('button',{name:'Сохранить цитату'}).click();
 await expect(page.getByRole('status')).toContainText('Цитата сохранена');
 await expect(page.locator('.reading-root')).not.toHaveClass(/reading-quote-mode/);
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.getByRole('button',{name:'Цитаты',exact:true}).click();
 await expect(page.locator('.saved-quote')).toHaveCount(1);
 await expect(page.locator('.saved-quote blockquote')).toContainText('Важные слова');
 await page.reload();
 await page.getByRole('button',{name:'Цитаты',exact:true}).click();
 await expect(page.locator('.saved-quote')).toHaveCount(1);
 await page.getByRole('button',{name:'Перейти к тексту'}).click();
 await expect(page.locator('.book-flow')).toContainText('Важные слова');
});
test('EPUB content selection opens quote popover and saves original selected text',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'quote.epub',mimeType:'application/epub+zip',buffer:epubFixture(false,'Quoted EPUB',12)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await page.getByRole('button',{name:'Цитата',exact:true}).click();
 await page.frameLocator('.epub-mount iframe').locator('p').first().evaluate(el=>{
  const node=el.firstChild as Text,range=el.ownerDocument.createRange();range.setStart(node,0);range.setEnd(node,Math.min(24,node.length));
  const selection=el.ownerDocument.getSelection()!;selection.removeAllRanges();selection.addRange(range);
  el.ownerDocument.dispatchEvent(new Event('selectionchange'));
 });
 await expect(page.getByRole('group',{name:'Действия с выделенной цитатой'})).toBeVisible();
 await page.getByRole('button',{name:'Сохранить цитату'}).click();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.getByRole('button',{name:'Цитаты',exact:true}).click();
 await expect(page.locator('.saved-quote blockquote')).toContainText('Passage');
});
