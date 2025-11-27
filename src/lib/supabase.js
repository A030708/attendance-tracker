// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helpful error in console if env vars are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase URL or ANON KEY missing.");
  console.error("Check your .env file: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
