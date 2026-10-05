import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan las variables de entorno de Supabase. Revisa tu archivo .env.local (mira .env.local.example)."
  );
}

// Cliente público (seguro para el navegador). NUNCA se usa aquí la Secret key.
export const supabase = createClient(supabaseUrl, supabaseKey);
