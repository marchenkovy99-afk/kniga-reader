import fs from 'node:fs/promises';
import {patchRelease} from './security-patches.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(process.argv[2]||path.join(here,'output'));
const root=path.join(output,'src');
const origin='https://libra-standalone-preview-gtge3kld0-marchenkovy99-3693.vercel.app/';
const originals={
  "assets/index-DMkgLOVA.js": "e3b8b1a3e2932adc63006203ea38e88c5e372dbd",
  "assets/index-SkfpHvwY.css": "59ca88fdff3155a58550235284001b58961f79bc",
  "assets/src-BLsCKbRG.js": "4aad359e4e4f70847b832f0b3f357d5da9986c68",
  "icon-180.png": "6e2fe495d5d278368832eae32f742961674ee7f8",
  "icon-512.png": "2e7b2bfa7b206cc404fea06c1e781c020449003a",
  "icon-mark.svg": "da991a8efd46e0c5e7417ee80e8620f52f3b559b",
  "icon.svg": "1ccbf5dc5d8fdba8766f94c28d01bac810c8e386",
  "manifest.webmanifest": "30b9f62a19392d853834941d3b463ec39b9e6f5d",
  "index.html": "d1e9699dba796b8f3533dfac7377824251ddae31",
  "offline-shell.txt": "d1e9699dba796b8f3533dfac7377824251ddae31",
  "sw.js": "ace8683bd30fbb014b6292b4b4a6dd6459a840a9",
  "release.json": "e8c62bbfda2d2831e80d7c4faff8635f79391d53"
};
await fs.mkdir(root,{recursive:true});
for(const [file,expected] of Object.entries(originals)){
 const response=await fetch(new URL(file,origin));if(!response.ok)throw Error(file+': '+response.status);
 const data=Buffer.from(await response.arrayBuffer());
 if(createHash('sha1').update(data).digest('hex')!==expected)throw Error('Published file mismatch: '+file);
 await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});
 await fs.writeFile(path.join(root,file),data);
}
await fs.cp(root,path.join(here,'.original-release'),{recursive:true});
const bundlePath=path.join(root,'assets/index-DMkgLOVA.js');
await fs.writeFile(bundlePath,patchRelease(await fs.readFile(bundlePath,'utf8')));
for(const file of ['reader-touch-fix.js','footnotes.js','footnote-content.js','reading-time.js'])await fs.copyFile(path.join(here,file),path.join(root,file));
const contentSecurityPolicy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' blob: https://qwnkigorqsgugcctnfmj.supabase.co wss://qwnkigorqsgugcctnfmj.supabase.co; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";
let html=await fs.readFile(path.join(root,'index.html'),'utf8');
html=html.replace('<meta charset="UTF-8" />','<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="'+contentSecurityPolicy+'" />');
html=html.replace('    <script type="module" crossorigin','    <script type="module" src="/reader-touch-fix.js"></script>\n    <script type="module" crossorigin');
await fs.writeFile(path.join(root,'index.html'),html);await fs.writeFile(path.join(root,'offline-shell.txt'),html);
let sw=await fs.readFile(path.join(root,'sw.js'),'utf8');
const urls=JSON.parse(sw.match(/const PRECACHE_URLS = (.*);/)[1]);urls.push('/reader-touch-fix.js','/footnotes.js','/footnote-content.js','/reading-time.js');
const hashes={};for(const url of urls)hashes[url]=createHash('sha256').update(await fs.readFile(path.join(root,url.slice(1)))).digest('hex');
const build=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
sw=sw.replace(/const CACHE_NAME = CACHE_PREFIX \+ '[^']+';/,"const CACHE_NAME = CACHE_PREFIX + '"+build+"';").replace(/const PRECACHE_URLS = .*;/,'const PRECACHE_URLS = '+JSON.stringify(urls)+';').replace(/const PRECACHE_HASHES = .*;/,'const PRECACHE_HASHES = '+JSON.stringify(hashes)+';');
await fs.writeFile(path.join(root,'sw.js'),sw);
await fs.writeFile(path.join(root,'release.json'),JSON.stringify({
 release:'2026-11-06-reading-time-cloud',baseCommit:'8d0fdb6',
 features:['per-book reading time with grow-only cloud sync and offline retry','existing November 6 reader interface','glass footnotes in FB2 and EPUB','revision and offline deletion race guards','DTD rejection','remote EPUB resource blocking'],
 recoveryBaseDeployment:'dpl_C6pMj1A1abRKbtpeUpbswhJVqcwC',repairRevision:9,offlineBuild:build,
 patchSha256:createHash('sha256').update(await fs.readFile(path.join(here,'security-patches.mjs'))).digest('hex')
}));
await fs.writeFile(path.join(output,'vercel.json'),JSON.stringify({version:2,framework:null,buildCommand:'',installCommand:'',outputDirectory:'src',headers:[
 {source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'},{key:'Content-Security-Policy',value:contentSecurityPolicy+"; frame-ancestors 'none'"}]},
 ...['/sw.js','/','/release.json','/reader-touch-fix.js','/footnotes.js'].map(source=>({source,headers:[{key:'Cache-Control',value:'no-cache, must-revalidate'}]}))
]}));
console.log('Recovered and verified current release; new offline cache:',build);
