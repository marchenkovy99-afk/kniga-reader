import {bookAppearanceKey} from './sync-model.js';
/** Serialize typography commits so a slow older IndexedDB write cannot win. */
export function createAppearanceWriter(storage,queue){
 let tail=Promise.resolve();
 return ({bookId,settings,updatedAt})=>{
  const saved={...settings};
  const commit=tail.catch(()=>{}).then(async()=>{
   await storage.setPreference('settings',saved);
   await storage.setPreference('settings-updatedAt',updatedAt);
   if(bookId)await storage.setPreference(bookAppearanceKey(bookId),{settings:saved,updatedAt});
   await queue('settings',saved,updatedAt);
   if(bookId)await queue(bookAppearanceKey(bookId),saved,updatedAt);
  });
  tail=commit;return commit;
 };
}
