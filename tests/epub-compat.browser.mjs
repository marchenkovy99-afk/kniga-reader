import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage(),external=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.origin!=='https://compat.test'){external.push(url.href);return route.abort();}
  const path=url.pathname;
  const body=path==='/fflate.js'?readFileSync(new URL('../node_modules/fflate/esm/browser.js',import.meta.url),'utf8'):path.endsWith('.js')?readFileSync(new URL('../reader'+path,import.meta.url),'utf8').replace("from 'fflate'","from '/fflate.js'"):'<html></html>';
  return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':'text/html',body});
 });
 await page.goto('https://compat.test/');
 const wrap=source=>Array.from(zipSync({'META-INF/container.xml':strToU8('<container><rootfile full-path="book.opf"/></container>'),'book.opf':strToU8('<package><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>'),'c.xhtml':strToU8(source)}));
 const cases=[
  wrap('<?xml version="1.0"?><!-- EPUB --><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "https://external.test/xhtml.dtd"><html><body><p>Текст&nbsp;&mdash; цитата&hellip;</p><pre><![CDATA[&nbsp; <!DOCTYPE html>]]></pre></body></html>'),
  wrap('<!DOCTYPE html [<!ENTITY secret SYSTEM "https://external.test/secret">]><html><body><p>&secret;</p></body></html>'),
 ];
 const result=await page.evaluate(async cases=>{
  const {importBook}=await import('/src/importer.js');
  const book=await importBook(new Uint8Array(cases[0]),'compat.epub');let rejected=false;
  try{await importBook(new Uint8Array(cases[1]),'unsafe.epub');}catch{rejected=true;}
  return {text:book.blocks.map(b=>b.text),rejected};
 },cases);
 assert.deepEqual(result,{text:['Текст\u00a0— цитата…','&nbsp; <!DOCTYPE html>'],rejected:true});
 assert.deepEqual(external,[],'EPUB declarations must never fetch an external DTD/resource');
 console.log('PASS: native browser XML parser accepts conventional XHTML, preserves entities/CDATA and rejects entity definitions without network access.');
}finally{await browser.close();}
