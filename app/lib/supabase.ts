import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl!, supabasePublicKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
