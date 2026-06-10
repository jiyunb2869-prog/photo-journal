// Supabase client (loaded from CDN as an ES module).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=2';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}
