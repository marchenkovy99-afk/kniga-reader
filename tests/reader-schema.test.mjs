import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const schema=readFileSync(new URL('../supabase/reader-schema.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/reader-appearance-migration.sql',import.meta.url),'utf8');

// A dependency-free structural check, not a complete PostgreSQL parser.
// Ignore comments/quoted strings so regex groups cannot hide broken SQL delimiters.
function statements(sql){
 const result=[];
 let current='',quoted=false,depth=0;
 const source=sql.replace(/--[^\n]*/g,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  current+=c;
  if(c==="'"){
   if(quoted&&source[i+1]==="'"){current+=source[++i];continue;}
   quoted=!quoted;
  }
  if(quoted)continue;
  if(c==='('||c==='[')depth++;
  if(c===')'||c===']')assert.ok(--depth>=0,'unexpected closing SQL delimiter');
  if(c===';'){
   assert.equal(depth,0,'SQL statement has unclosed delimiters');
   result.push(current.trim());current='';
  }
 }
 assert.equal(quoted,false,'unterminated SQL string literal');
 assert.equal(depth,0,'unclosed SQL delimiter');
 assert.equal(current.trim(),'','SQL statement must end with a semicolon');
 return result;
}

test('reader bootstrap SQL has balanced statements without duplicated setup operations',()=>{
 const sql=statements(schema);
 assert.equal(new Set(sql.map(s=>s.replace(/\s+/g,' ').toLowerCase())).size,sql.length,'duplicate bootstrap statement');
 const policyNames=sql.flatMap(s=>s.match(/^create policy (\w+)/i)?.[1]??[]);
 assert.equal(policyNames.length,6);
 assert.equal(new Set(policyNames).size,policyNames.length,'duplicate policy name');
 assert.equal(sql.filter(s=>/^create table /i.test(s)).length,2);
 assert.equal(sql.filter(s=>/^insert into storage\.buckets /i.test(s)).length,1);
});

test('bootstrap and appearance migration allow only supported per-book state keys',()=>{
 const hash='a'.repeat(64);
 for(const sql of [schema,migration]){
  const match=sql.match(/check\s*\(key\s*=\s*'settings'\s+or\s+key\s*~\s*'([^']+)'\s*\)/i);
  assert.ok(match,'complete state-key CHECK constraint');
  const pattern=new RegExp(match[1]);
  for(const key of ['position:sample','appearance:sample',`position:${hash}`,`appearance:${hash}`]){
   assert.ok(pattern.test(key),`must allow ${key}`);
  }
  for(const key of ['position:','appearance:other',`appearance:${hash}a`,`appearance:${hash}:extra`,`xposition:${hash}`,`position:${'A'.repeat(64)}`]){
   assert.equal(pattern.test(key),false,`must reject ${key}`);
  }
 }
});
