// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {IllustrationViewer} from '../components/IllustrationViewer';
it('zooms without changing the source and closes with focus restored',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const trigger=document.createElement('button'),host=document.createElement('div');document.body.append(trigger,host);trigger.focus();
 const root=createRoot(host);let closed=false;
 await act(async()=>{root.render(<IllustrationViewer image={{src:'data:image/png;base64,AA==',alt:'Карта'}} onClose={()=>{closed=true}}/>)});
 const image=host.querySelector('img')!,source=image.src;
 const zoom=host.querySelector<HTMLButtonElement>('[aria-label="Увеличить иллюстрацию"]')!;
 await act(async()=>zoom.click());
 expect(image.style.width).toBe('200%');expect(image.src).toBe(source);
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Закрыть иллюстрацию"]')!.click());
 expect(closed).toBe(true);
 await act(async()=>root.unmount());expect(document.activeElement).toBe(trigger);
 trigger.remove();host.remove();
});
