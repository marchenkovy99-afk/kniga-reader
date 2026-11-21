import {createClient} from '@supabase/supabase-js';
import type {CloudTransport,RemoteRecord} from './cloudSync';
export const cloudClient=createClient('https://qwnkigorqsgugcctnfmj.supabase.co','sb_publishable_pmAp_voLq3GvpnSAeu4AIw_opSxTWXB',{auth:{storageKey:'libra-cloud-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
export function cloudTransport(owner:string):CloudTransport{
 async function check(){const {data,error}=await cloudClient.auth.getSession();if(error)throw error;if(data.session?.user.id!==owner)throw Error('Войдите в свою учётную запись для синхронизации')}
 return {
 list:async()=>{await check();const rows:RemoteRecord[]=[];for(let offset=0;;offset+=500){const {data,error}=await cloudClient.from('libra_records').select('key,payload,revision,deleted').eq('user_id',owner).order('key').range(offset,offset+499);if(error)throw error;rows.push(...data as RemoteRecord[]);if(data.length<500)break}return rows},
 upload:async(path,file)=>{await check();const {error}=await cloudClient.storage.from('libra-files').upload(path,file,{upsert:false,contentType:'application/octet-stream'});if(error&&String(error.statusCode)!=='409'&&!error.message.toLowerCase().includes('already exists'))throw error},
 download:async path=>{await check();const {data,error}=await cloudClient.storage.from('libra-files').download(path);if(error)throw error;return data},
 cas:async(key,expected,payload,deleted)=>{await check();const {data,error}=await cloudClient.rpc('libra_compare_and_set',{p_key:key,p_expected:expected,p_payload:payload,p_deleted:deleted});if(error)throw error;return (data as RemoteRecord[])[0]}
 };
}
