import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
import {epubFixture} from './support/epub-fixture';
test('untrusted EPUB cannot execute scripts or load remote tracking resources',async({page,context})=>{
 const requests:string[]=[];await context.route('https://audit.invalid/**',r=>{requests.push(r.request().url());return r.abort()});
 await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',r=>r.abort());
 const archive=await JSZip.loadAsync(epubFixture(false,'Security EPUB',3));
 const source=await archive.file('OEBPS/one.xhtml')!.async('string');
 archive.file('OEBPS/one.xhtml',source.replace('</head>','<style>@import url("https://audit.invalid/style.css");</style></head>').replace('<body>','<body><script>parent.__auditPwned=true</script><img src="https://audit.invalid/pixel.png" onerror="parent.__auditPwned=true"/><iframe src="https://audit.invalid/frame"></iframe>'));
 await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'security.epub',mimeType:'application/epub+zip',buffer:await archive.generateAsync({type:'nodebuffer'})});
 await page.locator('.continue-card').click();await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await expect(page.frameLocator('.epub-mount iframe').locator('p').first()).toContainText('Passage 0');
 await page.frameLocator('.epub-mount iframe').locator('img').evaluate(async(img:HTMLImageElement)=>{if(!img.complete)await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;setTimeout(resolve,500)})});
 expect(await page.evaluate(()=>Boolean((window as any).__auditPwned))).toBe(false);expect(requests).toEqual([]);
});
test('FB2 custom entities are rejected without saving a partial book',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'entities.fb2',mimeType:'text/xml',buffer:Buffer.from('<!DOCTYPE FictionBook [<!ENTITY x "expanded">]><FictionBook><body><section><p>&x;</p></section></body></FictionBook>')});
 await expect(page.locator('.app-error')).toContainText(/DTD|DOCTYPE/);await expect(page.locator('.book-tile')).toHaveCount(0);
});
