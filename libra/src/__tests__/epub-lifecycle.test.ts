import {it,expect,vi} from 'vitest';
import {waitForEpub} from '../reader/epubLifecycle';
it('bounds damaged EPUB opening instead of leaving a permanent spinner',async()=>{
 vi.useFakeTimers();
 const promise=waitForEpub({opened:new Promise(()=>{}),ready:Promise.resolve()},100);
 const assertion=expect(promise).rejects.toThrow('EPUB');
 await vi.advanceTimersByTimeAsync(101);await assertion;vi.useRealTimers();
});
it('reports an EPUB parser failure immediately',async()=>{
 const book={opened:Promise.reject(new Error('Broken archive')),ready:Promise.resolve()};
 await expect(waitForEpub(book)).rejects.toThrow('Broken archive');
});
