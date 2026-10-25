// Run with the same Playwright environment as reader-animation.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true});
 const css=readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8');
 const source=readFileSync(new URL('../reader/src/chrome-controls.js',import.meta.url),'utf8');
 await page.setContent(`<style>${css}</style><div class="reader"><header class="reader-header"><button id="back" class="icon-button">Назад</button></header><main class="book-stage"><div class="book-text">Страница книги</div></main><footer class="reader-footer"><button id="settings" class="icon-button">Aa</button></footer></div>`);
 await page.evaluate(async source=>{
  const {attachReaderChrome}=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))));
  window.turns=[];window.actions=[];
  attachReaderChrome(document.querySelector('.book-stage'),dir=>window.turns.push(dir));
  for(const id of ['back','settings'])document.getElementById(id).onclick=()=>window.actions.push(id);
 },source);
 const center=async()=>page.touchscreen.tap(196,426);
 const checkLayers=()=>page.evaluate(()=>['#back','#settings'].map(selector=>{
  const button=document.querySelector(selector),panel=button.parentElement,rect=button.getBoundingClientRect(),style=getComputedStyle(panel);
  return {selector,visible:rect.width>0&&rect.height>0&&style.visibility==='visible'&&Number(style.opacity)>0,ownsHit:button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))};
 }));
 for(let i=0;i<10;i++){
  await center();
  await page.locator('#settings').tap();await page.locator('#back').tap();
  assert.deepEqual(await page.evaluate(()=>window.turns),[],'toolbar taps must never turn pages');
  // Sample immediately after hiding, while the old opacity transition is still painted.
  await center();
  for(const panel of await checkLayers())assert.ok(!panel.visible||panel.ownsHit,`${panel.selector}: visible controls pass touches through to the book`);
 }
 assert.equal((await page.evaluate(()=>window.actions)).length,20);
 console.log('PASS: repeated touch toggles, toolbar hit testing, no visible but unclickable closing panels.');
}finally{await browser.close();}
