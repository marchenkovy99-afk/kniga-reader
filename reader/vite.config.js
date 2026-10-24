import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/reader/',build:{target:'es2022',outDir:'../public/reader',emptyOutDir:true}});
