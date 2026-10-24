import {createClient} from '@supabase/supabase-js';
import {SupabaseTransport} from './supabase-transport.js';
// Publishable key; server authorization is enforced by RLS, never by this key.
export const supabase=createClient('https://qwnkigorqsgugcctnfmj.supabase.co','sb_publishable_pmAp_voLq3GvpnSAeu4AIw_opSxTWXB',{auth:{storageKey:'kniga-supabase-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export const supabaseTransport=new SupabaseTransport(supabase);
