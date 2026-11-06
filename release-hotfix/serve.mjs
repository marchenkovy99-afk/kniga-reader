import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('output/src/',import.meta.url));
const config=JSON.parse(fs.readFileSync(new URL('output/vercel.json',import.meta.url),'utf8'));
http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',file=path.resolve(root,name);
 if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 for(const rule of config.headers)if(rule.source==='/(.*)'||rule.source==='/'+name||rule.source==='/'&&name==='index.html')for(const header of rule.headers)res.setHeader(header.key,header.value);
 const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.txt':'text/html','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(name)]||'application/octet-stream';
 res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
}).listen(4180,'127.0.0.1');
