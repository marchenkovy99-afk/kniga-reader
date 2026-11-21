import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
const owner='10000000-0000-4000-8000-000000000001';
const source='<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Облачная книга</book-title><author><first-name>Автор</first-name></author></title-info></description><body><section><title><p>Глава</p></title>'+Array.from({length:40},(_,i)=>'<p>'+i+' Проверка книги между двумя устройствами. '.repeat(16)+'</p>').join('')+'</section></body></FictionBook>';
const bytes=Buffer.from(source),hash=createHash('sha256').update(bytes).digest('hex');
function backend(){
 const rows=new Map<string,{key:string;payload:Record<string,unknown>;revision:number;deleted:boolean}>(),files=new Map<string,Buffer>();
 async function install(context:BrowserContext){
  await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
   const json=(data:unknown,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(url.pathname==='/auth/v1/token'){
    const now=Math.floor(Date.now()/1000),user={id:owner,aud:'authenticated',role:'authenticated',email:'reader@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
    const enc=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString('base64url');
    return json({access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:owner,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})+'.test',refresh_token:'test-refresh',expires_at:now+3600,expires_in:3600,token_type:'bearer',user});
   }
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers});
   if(url.pathname==='/rest/v1/libra_records')return json([...rows.values()]);
   if(url.pathname==='/rest/v1/rpc/libra_compare_and_set'){
    const body=request.postDataJSON(),old=rows.get(body.p_key);
    if(old?.deleted||(old?.revision??0)!==body.p_expected)return json([]);
    const row={key:body.p_key,payload:body.p_payload,deleted:body.p_deleted,revision:(old?.revision??0)+1};rows.set(row.key,row);return json([row]);
   }
   const marker='/storage/v1/object/',index=url.pathname.indexOf(marker);
   if(index===0){const key=url.pathname.slice(marker.length).replace(/^authenticated\//,'');
    if(request.method()==='POST'){expect(key).toBe('libra-files/'+owner+'/'+hash);if(files.has(key))return json({statusCode:409,message:'The resource already exists'},409);files.set(key,bytes);return json({Key:key})}
    const file=files.get(key);return file?route.fulfill({status:200,headers,contentType:'application/octet-stream',body:file}):json({message:'missing'},404);
   }
   return json({message:'Unexpected mocked request '+url.pathname},500);
  });
 }
 return {install,rows};
}
async function settings(page:Page){await page.getByRole('button',{name:'Настройки',exact:true}).click()}
async function login(page:Page){await settings(page);await page.getByLabel('Электронная почта').fill('reader@example.test');await page.getByLabel('Пароль',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByText('reader@example.test',{exact:true})).toBeVisible()}
test('two isolated devices synchronize exact book bytes, bookmarks, preferences and durable offline edits',async({browser})=>{
 test.setTimeout(90000);const server=backend(),a=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),b=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await Promise.all([server.install(a),server.install(b)]);
 const first=await a.newPage(),second=await b.newPage();
 try{
  await first.goto('/');await first.locator('input[type=file]').first().setInputFiles({name:'cloud.fb2',mimeType:'text/xml',buffer:bytes});
  await login(first);await first.getByRole('button',{name:'Подключить и объединить библиотеку'}).click();await expect.poll(()=>server.rows.size).toBe(1); // Fresh accounts must not upload default preferences.
  await second.goto('/');await login(second);await second.getByRole('button',{name:'Подключить и объединить библиотеку'}).click();
  await expect(second.locator('.cloud-conflict')).toHaveCount(0); // No phantom settings conflict on a fresh device.
  await second.getByRole('button',{name:'Библиотека',exact:true}).click();await expect(second.locator('.book-tile')).toHaveCount(1);await second.locator('.continue-card').click();await expect(second.locator('.book-flow')).toContainText('Проверка книги между двумя устройствами');
  await second.locator('.reading-zones').click({position:{x:190,y:230}});await second.getByRole('button',{name:'Закладка',exact:true}).click();await second.getByRole('button',{name:'В библиотеку'}).click();
  await settings(second);await second.getByRole('button',{name:'Синхронизировать',exact:true}).click();await expect.poll(()=>[...server.rows.values()].find(r=>r.key.startsWith('book:'))?.payload.bookmarks).toHaveLength(1);
  await first.getByRole('button',{name:'Библиотека',exact:true}).click();
  await first.locator('.continue-card').click();
  await first.locator('.reading-zones').click({position:{x:190,y:230}});
  await first.getByRole('button',{name:'Текст',exact:true}).click();
  await first.getByRole('slider',{name:/Размер текста/}).fill('27');
  await first.getByRole('slider',{name:/Между словами/}).fill('1.5');
  await first.getByRole('button',{name:'Закрыть',exact:true}).click();
  await first.getByRole('button',{name:'В библиотеку'}).click();
  await settings(first);
  await a.setOffline(true);await first.getByRole('button',{name:'OLED',exact:true}).click();await expect(first.locator('.cloud-panel')).toContainText('Нет сети');
  await a.setOffline(false);await first.getByRole('button',{name:'Синхронизировать',exact:true}).click();await expect.poll(()=>server.rows.get('settings')?.payload.settings).toMatchObject({theme:'oled',fontSize:27,wordSpacing:1.5});
  await second.getByRole('button',{name:'Синхронизировать',exact:true}).click();await expect(second.getByRole('button',{name:'OLED',exact:true})).toHaveClass(/chosen/);
  await second.getByRole('button',{name:'Выйти',exact:true}).click();await second.getByRole('button',{name:'Библиотека',exact:true}).click();await expect(second.locator('.book-tile')).toHaveCount(0);await expect(second.getByText('Книги аккаунта сохранены на устройстве.',{exact:false})).toBeVisible();
 }finally{await a.close();await b.close()}
});
