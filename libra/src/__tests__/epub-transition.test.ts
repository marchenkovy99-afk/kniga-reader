// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {freezeEpubViewport} from '../reader/epubTransition';
it('keeps an inert styled copy until the final EPUB page is ready without mutating its CFI DOM',()=>{
 const host=document.createElement('div'),frame=document.createElement('iframe');host.append(frame);document.body.append(host);
 const doc=frame.contentDocument!;doc.head.innerHTML='<style>p { color: rgb(20, 30, 40); }</style>';
 doc.body.innerHTML='<p onclick="alert(1)">Outgoing page</p><script>throw Error("must not run")</script><img onerror="alert(1)" src="cover.png"/>';
 const original=doc.body.innerHTML,paragraph=doc.querySelector('p');
 Object.defineProperty(host,'getBoundingClientRect',{value:()=>({left:10,top:20,right:330,bottom:620,width:320,height:600})});
 Object.defineProperty(frame,'getBoundingClientRect',{value:()=>({left:-310,top:20,right:970,bottom:620,width:1280,height:600})});
 const release=freezeEpubViewport(host);
 const overlay=host.querySelector('.epub-transition-freeze')!;
 expect(overlay.hasAttribute('inert')).toBe(true);
 const shadow=overlay.firstElementChild!.shadowRoot!;
 expect(shadow.textContent).toContain('Outgoing page');expect(shadow.querySelector('script')).toBeNull();expect(shadow.querySelector('[onclick],[onerror]')).toBeNull();
 expect(shadow.querySelector('style')!.textContent).toContain('rgb(20, 30, 40)');
 expect((overlay.firstElementChild as HTMLElement).style.left).toBe('-320px');
 expect(doc.body.innerHTML).toBe(original);expect(doc.querySelector('p')).toBe(paragraph);
 release();release();expect(host.querySelector('.epub-transition-freeze')).toBeNull();host.remove();
});
