import {test,expect} from '@playwright/test';
const sample=Array.from({length:110},(_,i)=>'<p>Проверка '+i+'. Примечательно, что необыкновенные обстоятельства и продолжительные размышления провоцируют многочисленные впечатления относительно справедливости, читательского восприятия и добросовестности.</p>').join('');
const fb2='<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Переносы и выравнивание</book-title></title-info></description><body><section>'+sample+'</section></body></FictionBook>';
test('Russian FB2 paragraphs justify, hyphenate, retain the exact book text and do not clip',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'justify.fb2',mimeType:'text/xml',buffer:Buffer.from(fb2)});
 await page.locator('.continue-card').click();
 const paragraph=page.locator('.book-flow .book-paragraph').first();
 await expect(paragraph).toBeVisible();
 const props=await paragraph.evaluate(el=>{const c=getComputedStyle(el);return {align:c.textAlign,lang:el.closest('[lang]')?.getAttribute('lang'),hyphens:c.hyphens,wrap:c.overflowWrap,break:c.wordBreak}});
 expect(props.align).toBe('justify');expect(props.lang).toBe('ru');
 expect(props.hyphens).toBe('auto');expect(props.wrap).toBe('break-word');expect(props.break).toBe('normal');
 expect(await page.locator('.book-flow').innerText()).toContain('добросовестности');
 await expect(page.getByRole('alert')).toHaveCount(0);
});
