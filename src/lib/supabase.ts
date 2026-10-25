// Supabase client (production only). Every request carries the user's session; the database policies (RLS) decide.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PROD, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

export function sb() {
  if (!PROD) throw new Error("Supabase n'est pas configuré.");
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "sillage-auth" },
  });
  return client;
}

// Messages for people, not developers: the technical detail goes to the console.
export function friendly(e: { message?: string; code?: string } | null | undefined): string {
  const m = e?.message ?? "";
  console.error("supabase", e);
  if (/JWT|session|not authenticated/i.test(m)) return "Votre session a expiré. Reconnectez-vous.";
  if (/row-level security|permission denied|interdit/i.test(m)) return "Cette action n'est pas autorisée.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Pas de connexion. Vérifiez internet et réessayez.";
  if (/launched|is_launched/i.test(m)) return "L'ajout de documents ouvrira au lancement officiel.";
  // Our own SQL functions raise short French messages: show them as they are.
  if (m && m.length < 120 && !/[_(){}]/.test(m)) return m.charAt(0).toUpperCase() + m.slice(1) + ".";
  return "Une erreur est survenue. Réessayez dans un instant.";
}

// One call to the database; throws a readable error.
export async function q<T>(p: PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(friendly(error));
  return data;
}
