/** Book files may be shared by content hash; reading data always belongs to an account. */
export const accountPreferenceKey=(owner,key)=>'account-state:'+encodeURIComponent(owner||'guest')+':'+key;
export const bookBelongsToAccount=(book,owner)=>book.id==='sample'||!book.cloudOwner||book.cloudOwner===owner||Boolean(book.cloudOwners?.includes(owner));
const readingKey=key=>key==='settings'||key==='settings-updatedAt'||key.startsWith('position:')||key.startsWith('appearance:');
export function createAccountState(store){
 const forOwner=owner=>({
  getPreference:key=>store.getPreference(accountPreferenceKey(owner,key)),
  setPreference:(key,value)=>store.setPreference(accountPreferenceKey(owner,key),value)
 });
 const migrateLegacy=async owner=>{
  if(await store.getPreference('account-state-migrated-v1'))return;
  const target=forOwner(owner);
  for(const key of await store.listPreferenceKeys()){
   if(!readingKey(key)||await target.getPreference(key)!==undefined)continue;
   const value=await store.getPreference(key);if(value!==undefined)await target.setPreference(key,value);
  }
  // Keep originals for recovery, but never import them into another account.
  await store.setPreference('account-state-migrated-v1',true);
 };
 const adoptGuest=async owner=>{
  if(!owner)return;
  const prefix=accountPreferenceKey(null,''),target=forOwner(owner);
  for(const source of await store.listPreferenceKeys(prefix)){
   const key=source.slice(prefix.length);
   if(await target.getPreference(key)===undefined)await target.setPreference(key,await store.getPreference(source));
  }
 };
 return {forOwner,migrateLegacy,adoptGuest};
}
