import {build} from 'vite';
import {fileURLToPath} from 'node:url';

// Browser fixtures exercise the production module, including dictionary imports.
export async function paginationModule(){
 const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,rolldownOptions:{output:{codeSplitting:false}},lib:{entry:fileURLToPath(new URL('../reader/src/pagination.js',import.meta.url)),formats:['es']}}});
 return (Array.isArray(result)?result[0]:result).output.find(file=>file.type==='chunk'&&file.isEntry).code;
}
