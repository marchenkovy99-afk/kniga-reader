// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {coverDataUrl} from '../covers';
import {generatedJacket} from '../components/BookCover';

it('creates stable book jackets with no fabricated cover images',()=>{
 expect(generatedJacket('Название книги')).toEqual(generatedJacket('Название книги'));
 expect(generatedJacket('Название книги').paper).toMatch(/^#[A-Fa-f0-9]{6}$/);
});
it('stores temporary EPUB cover URLs as durable, portable data',async()=>{
 const original=globalThis.fetch;
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
 globalThis.fetch=vi.fn(async()=>({ok:true,blob:async()=>new Blob([bytes],{type:'image/png'})} as Response));
 try{
  const data=await coverDataUrl('blob:https://example.test/cover');
  expect(data).toMatch(/^data:image\/png;base64,/);
  expect(await coverDataUrl('https://example.test/external')).toBeUndefined();
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
 }finally{globalThis.fetch=original}
});
