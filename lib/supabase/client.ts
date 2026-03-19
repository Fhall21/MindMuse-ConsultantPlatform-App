import { createBrowserClient } from "@supabase/ssr";

// Temporary compatibility shim for auth-owned UI surfaces.
// Remove this once the Better Auth cutover lands on the integration branch.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
