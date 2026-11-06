import {test,expect} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
test('installed old PWA updates its cache without losing the book or reading position',async({page,context})=>{
 let updated=false;
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  const file=path.join(process.cwd(),updated?'output/src':'.original-release',name);
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const ext=path.extname(name);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.html'||name==='offline-shell.txt'?'text/html':ext==='.webmanifest'?'application/manifest+json':'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  await page.goto(origin);
  const book='<FictionBook><description><title-info><book-title>Обновление PWA</book-title></title-info></description><body><section><p>'+('Сохранённый текст книги. '.repeat(300))+'</p></section></body></FictionBook>';
  await page.locator('input[type=file]').first().setInputFiles({name:'upgrade.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
  await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toBeVisible();
  await expect.poll(()=>page.evaluate(async()=>{await navigator.serviceWorker.ready;return !!navigator.serviceWorker.controller})).toBe(true);
  const before=await page.locator('.reading-status span').first().textContent();
  updated=true;
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update()});
  await expect.poll(()=>page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();return registration?.waiting?.state==='installed'}),{timeout:15000}).toBe(true);
  await page.close();page=await context.newPage();await page.goto(origin);
  await expect(page.locator('.reading-root, .continue-card').first()).toBeVisible();
  if(await page.locator('.continue-card').count())await page.locator('.continue-card').click();
  await expect(page.locator('.book-flow')).toBeVisible();
  await expect(page.locator('.reading-status span').first()).toHaveText(before);
  const zones=page.locator('.reading-zones'),box=await zones.boundingBox(),p={identifier:1,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
  await page.touchscreen.tap(p.clientX,p.clientY);
  await expect(page.locator('.reading-top')).toHaveClass(/visible/);
  // Shut the origin down: WebKit's synthetic network-offline mode can bypass its SW.
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  await page.reload();
  await expect(page.locator('.reading-root, .continue-card').first()).toBeVisible();
  if(await page.locator('.continue-card').count())await page.locator('.continue-card').click();
  await expect(page.locator('.book-flow')).toContainText('Сохранённый текст книги.');
 }finally{await context.setOffline(false);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
