import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  window.env.NEXT_PUBLIC_SUPABASE_URL,
  window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
