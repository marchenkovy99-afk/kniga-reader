import {test,expect} from '@playwright/test';

/** Stored ZIP writer: minimum EPUB2 fixture, no external services or fixtures. */
function epubFixture():Buffer{
 const chapterParagraphs=Array.from({length:140},(_,i)=>
  '<p>Passage '+i+' '+('The complete book remains visible after typography changes. '.repeat(7))+'</p>').join('');
 const files=[
  ['mimetype','application/epub+zip'],
  ['META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
  ['OEBPS/content.opf','<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>EPUB fixture</dc:title><dc:identifier id="uid">urn:uuid:aa-bb-cc</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/></spine></package>'],
  ['OEBPS/toc.ncx','<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:aa-bb-cc"/></head><docTitle><text>EPUB fixture</text></docTitle><navMap><navPoint id="one" playOrder="1"><navLabel><text>Opening</text></navLabel><content src="one.xhtml"/></navPoint></navMap></ncx>'],
  ['OEBPS/one.xhtml','<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Opening</title></head><body><h1>FIRST CHAPTER</h1>'+chapterParagraphs+'<p>END OF BOOK</p></body></html>']
 ];
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
