import {test,expect} from '@playwright/test';

const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Единая тема</book-title></title-info></description>'+
 '<body><section><p>Весь текст должен быть виден на ровном фоне.</p></section></body></FictionBook>';
const themes=[
 {name:'paper',background:'rgb(246, 243, 236)',meta:'#F6F3EC',status:'default'},
 {name:'white',background:'rgb(255, 255, 255)',meta:'#FFFFFF',status:'default'},
 {name:'night',background:'rgb(29, 31, 30)',meta:'#1D1F1E',status:'black-translucent'},
 {name:'oled',background:'rgb(0, 0, 0)',meta:'#000000',status:'black-translucent'}
] as const;

test('theme color matches every shell panel, reader chrome and iPhone status-bar metadata',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'color.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 for(const theme of themes){
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.locator('.settings-themes [data-option="'+theme.name+'"]').click();
  await page.getByRole('button',{name:'Библиотека'}).click();
  await expect(page.locator('.continue-card')).toBeVisible();
  await page.locator('.continue-card').click();
  await expect(page.locator('.book-flow')).toBeVisible();
  await page.locator('.reading-zones').click({position:{x:190,y:220}});
  await expect(page.locator('.reading-top')).toHaveClass(/visible/);
  const observed=await page.evaluate(()=>({
   html:getComputedStyle(document.documentElement).backgroundColor,
   body:getComputedStyle(document.body).backgroundColor,
   app:getComputedStyle(document.querySelector('#root')!).backgroundColor,
   shell:getComputedStyle(document.querySelector('.reading-root')!).backgroundColor,
   header:getComputedStyle(document.querySelector('.reading-top')!).backgroundColor,
   footer:getComputedStyle(document.querySelector('.reading-bottom')!).backgroundColor,
   meta:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
   status:document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')
  }));
  for(const field of ['html','body','app','shell','header','footer'] as const)
   expect(observed[field],theme.name+' '+field).toBe(theme.background);
  expect(observed.meta).toBe(theme.meta);
  expect(observed.status).toBe(theme.status);
  await page.getByRole('button',{name:'В библиотеку'}).click();
 }
});
