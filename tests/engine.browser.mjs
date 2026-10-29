import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Separate browser contexts and a local, disposable origin; no real Supabase
// session is touched. Linux WebKit coverage is not physical iPhone acceptance.
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=await mkdtemp(join(tmpdir(),'kniga-engine-'));
await cp(join(root,'docs'),join(out,'kniga-reader'),{recursive:true});
const index=join(out,'kniga-reader/index.html');
await writeFile(index,(await readFile(index,'utf8')).replace(/connect-src[^;\"]*/g,"connect-src 'none'"));
for(const name of ['engine','engine-performance'])execFileSync(process.execPath,[join(root,'tests/build-engine-fixture.mjs'),name,join(out,`${name}.html`)],{cwd:root});
execFileSync(process.execPath,[join(root,'tests/build-rendered-reader-fixture.mjs'),join(out,'reader.html')],{cwd:root});
const server=createServer(async(req,res)=>{
 try{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'engine.html';
  const path=resolve(out,relative.endsWith('/')?relative+'index.html':relative);
  if(!path.startsWith(out+'/')){res.writeHead(403).end();return;}
  const body=await readFile(path),type={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(path)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
await mkdir(join(root,'test-results/engine'),{recursive:true});
try{
 for(const browserName of (process.env.ENGINE_BROWSERS||'chromium,webkit').split(',')){
  const browser=await playwright[browserName].launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1200,height:1000},serviceWorkers:'block'});
   await context.route('**/*.supabase.co/**',route=>route.abort());
   for(const fixture of ['engine','reader','engine-performance']){
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/${fixture}.html`);
    await page.waitForFunction(()=>['pass','fail'].includes(document.body.dataset.result),null,{timeout:180000});
    const report=await page.locator('#results').textContent(),result=await page.locator('body').getAttribute('data-result');
    await writeFile(join(root,`test-results/engine/${browserName}-${fixture}.json`),report);
    await page.screenshot({path:join(root,`test-results/engine/${browserName}-${fixture}.png`),fullPage:false});
    assert.equal(result,'pass',`${browserName}/${fixture}: ${report}`);assert.deepEqual(errors,[],`${browserName}/${fixture} page errors`);
    console.log(`${browserName}/${fixture}: PASS`);await page.close();
   }
  }finally{await browser.close();}
 }
}finally{server.close();}
