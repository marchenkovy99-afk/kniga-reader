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
