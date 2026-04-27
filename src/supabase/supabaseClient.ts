import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient>;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url: string = process.env.SUPABASE_URL!;
    const key: string = process.env.SUPABASE_KEY!;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}
