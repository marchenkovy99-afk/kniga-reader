import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>({root:fileURLToPath(new URL('.',import.meta.url)),base:mode==='pages'?'/kniga-reader/':'/reader/',build:{target:'es2022',outDir:mode==='pages'?'../docs':'../public/reader',emptyOutDir:mode!=='pages'}}));
