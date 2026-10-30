import {test,expect} from '@playwright/test';

/** A real, self-contained three-page PDF: no external fixture or network. */
function pdfFixture():Buffer{
 const objects=new Map<number,string>();
 objects.set(1,'<< /Type /Catalog /Pages 2 0 R >>');
 objects.set(2,'<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>');
 objects.set(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 for(let n=1;n<=3;n++){
  const page=4+(n-1)*2,contents=page+1;
  const stream='BT /F1 32 Tf 56 720 Td (DOCUMENT PAGE '+n+') Tj ET';
  objects.set(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+contents+' 0 R >>');
  objects.set(contents,'<< /Length '+Buffer.byteLength(stream,'ascii')+' >>\nstream\n'+stream+'\nendstream');
 }
 let data='%PDF-1.4\n',offsets=[0];
 for(let n=1;n<=objects.size;n++){
  offsets[n]=Buffer.byteLength(data,'ascii');
  data+=n+' 0 obj\n'+objects.get(n)+'\nendobj\n';
 }
 const xref=Buffer.byteLength(data,'ascii');
 data+='xref\n0 '+(objects.size+1)+'\n0000000000 65535 f \n';
 for(let n=1;n<=objects.size;n++)data+=String(offsets[n]).padStart(10,'0')+' 00000 n \n';
 data+='trailer\n<< /Size '+(objects.size+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(data,'ascii');
}
async function canvasDigest(page:import('@playwright/test').Page){
 return page.locator('.pdf-page canvas').evaluate(el=>{
  const c=el as HTMLCanvasElement;
  const data=c.getContext('2d')?.getImageData(0,0,c.width,c.height).data;
  if(!data)return {width:c.width,height:c.height,ink:0,signature:''};
  let ink=0,hash=0;
  for(let i=0;i<data.length;i+=16){
   const a=data[i+3];
   const dark=a>20&&(data[i]<190||data[i+1]<190||data[i+2]<190);
   if(dark)ink++;
   hash=(Math.imul(hash,33)+data[i]+data[i+1]+data[i+2])>>>0;
  }
  return {width:c.width,height:c.height,ink,signature:String(hash)};
 });
}

test('PDF page rendering remains valid on repeated flips, resize and reopen',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'three-pages.pdf',mimeType:'application/pdf',buffer:pdfFixture()});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.pdf-page canvas')).toBeVisible();
 await expect(page.locator('.reading-progress')).toContainText('Страница 1 из 3');
 await expect.poll(async()=>(await canvasDigest(page)).ink).toBeGreaterThan(10);
 const first=await canvasDigest(page);
 await page.locator('.reading-zones').click({position:{x:340,y:250}});
 await expect(page.locator('.reading-progress')).toContainText('Страница 2 из 3');
 await expect.poll(async()=>(await canvasDigest(page)).signature).not.toBe(first.signature);
 await page.locator('.reading-zones').click({position:{x:340,y:250}});
 await expect(page.locator('.reading-progress')).toContainText('Страница 3 из 3');
 await page.setViewportSize({width:320,height:568});
 await expect.poll(async()=>(await canvasDigest(page)).width).toBeLessThan(first.width);
 await expect.poll(async()=>(await canvasDigest(page)).ink).toBeGreaterThan(10);
 await expect(page.locator('.app-error')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.reading-progress')).toContainText('Страница 3 из 3');
 await expect.poll(async()=>(await canvasDigest(page)).ink).toBeGreaterThan(10);
 await expect(page.locator('.app-error')).toHaveCount(0);
});


/** Oversized MediaBox: the browser must scale below 0.1, not crop the page. */
function oversizedPdfFixture():Buffer {
 const stream='0 0 0 RG 100 w 50 50 9900 9900 re S BT /F1 700 Tf 650 4500 Td (CENTER PAGE) Tj ET';
 const parts=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10000 10000] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
  '<< /Length '+Buffer.byteLength(stream,'ascii')+' >>\nstream\n'+stream+'\nendstream'
 ];
 let data='%PDF-1.4\n';
 const offsets=[0];
 for(let i=0;i<parts.length;i++){
  offsets[i+1]=Buffer.byteLength(data,'ascii');
  data+=(i+1)+' 0 obj\n'+parts[i]+'\nendobj\n';
 }
 const start=Buffer.byteLength(data,'ascii');
 data+='xref\n0 6\n0000000000 65535 f \n';
 for(let i=1;i<=5;i++)data+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 data+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 return Buffer.from(data,'ascii');
}

test('a PDF with a very large MediaBox is completely fitted, never cropped to a minimum scale',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'huge-layout.pdf',mimeType:'application/pdf',buffer:oversizedPdfFixture()
 });
 await page.locator('.continue-card').click();
 await expect(page.locator('.pdf-page canvas')).toBeVisible({timeout:15000});
 await expect.poll(async()=>(await canvasDigest(page)).ink).toBeGreaterThan(10);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:1024}]){
  await page.setViewportSize(size);
  await expect.poll(()=>page.locator('.pdf-page canvas').evaluate(canvas=>{
   const parent=canvas.parentElement!.getBoundingClientRect();
   const rect=canvas.getBoundingClientRect();
   return rect.width<=parent.width-12&&rect.height<=parent.height-12 &&
    rect.left>=parent.left-3&&rect.right<=parent.right+3&&
    rect.top>=parent.top-3&&rect.bottom<=parent.bottom+3;
  })).toBe(true);
  expect(await canvasDigest(page)).toMatchObject({ink:expect.any(Number)});
  expect((await canvasDigest(page)).ink).toBeGreaterThan(10);
 }
 await expect(page.locator('.app-error')).toHaveCount(0);
});
