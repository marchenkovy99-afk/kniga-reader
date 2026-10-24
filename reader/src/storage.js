let connection;
function database(){
 if(!connection)connection=new Promise((resolve,reject)=>{
  const request=indexedDB.open('kniga-reader',1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('books',{keyPath:'id'});db.createObjectStore('preferences');};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{connection=null;reject(new Error('Не удалось открыть хранилище. Проверьте настройки браузера.'));};
 });
 return connection;
}
async function transaction(store,mode,operation){
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));let result;
  request.onsuccess=()=>{result=request.result;};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('Не удалось сохранить данные. Возможно, закончилось место на устройстве.'));
  tx.onabort=()=>reject(new Error('Сохранение прервано. Попробуйте ещё раз.'));
 });
}
export const listBooks=()=>transaction('books','readonly',s=>s.getAll());
export const putBook=book=>transaction('books','readwrite',s=>s.put(book));
export const getPreference=key=>transaction('preferences','readonly',s=>s.get(key));
export const setPreference=(key,value)=>transaction('preferences','readwrite',s=>s.put(value,key));
export const deleteBook=id=>transaction('books','readwrite',s=>s.delete(id));
