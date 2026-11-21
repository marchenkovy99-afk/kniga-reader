// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {ReadingControls} from '../components/ReadingControls';
import {DEFAULT_SETTINGS,type StoredBook} from '../domain';

it('opens overlay tools and settings without changing preferences or remounting book text',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host),onSettings=vi.fn();
 const settings={...DEFAULT_SETTINGS,fontSize:23,lineHeight:1.65,margin:18,marginRight:22};
 const original=JSON.stringify(settings);
 const book={id:'overlay-test',title:'Тест',bookmarks:[]} as unknown as StoredBook;
 const position={format:'fb2',fraction:.5,anchor:{block:0,offset:0}} as any;
 await act(async()=>root.render(<ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={()=>{}} onNext={()=>{}} onPrevious={()=>{}} position={position} progress={50} caption="288" pageNumber={288} totalPages={500} onPage={()=>{}} chapters={[{title:'Глава',page:1}]}><article data-testid="book">Неизменный текст книги</article></ReadingControls>));
 const text=host.querySelector('[data-testid="book"]');
 const click=async(selector:string)=>{await act(async()=>{(host.querySelector(selector) as HTMLElement).click()})};
 await click('.reading-status');
 expect(host.querySelector('.reading-bottom')?.classList.contains('visible')).toBe(true);
 expect(host.querySelectorAll('.reading-tools button')).toHaveLength(4);
 await act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Текст')!.click()});
 expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Настройки чтения');
 expect(host.querySelectorAll('.sheet-settings input[type="range"]').length).toBeGreaterThan(8);
 const sliders=Array.from(host.querySelectorAll<HTMLInputElement>('.sheet-settings input[type="range"]'));
 expect(sliders.find(el=>el.closest('label')?.textContent?.startsWith('Размер текста'))?.step).toBe('0.5');
 const lineSpacing=sliders.find(el=>el.closest('label')?.textContent?.startsWith('Интервал строк'))!;
 expect(lineSpacing.min).toBe('1');
 expect(lineSpacing.step).toBe('.025');
 await click('[aria-label="Закрыть"]');
 await click('[aria-label="Скрыть управление чтением"]');
 expect(host.querySelector('.reading-bottom')?.classList.contains('visible')).toBe(false);
 expect(host.querySelector('[data-testid="book"]')).toBe(text);
 expect(onSettings).not.toHaveBeenCalled();
 expect(JSON.stringify(settings)).toBe(original);
 await act(async()=>root.unmount());host.remove();
});
