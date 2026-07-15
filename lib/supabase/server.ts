import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "./config.ts";
export async function createClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  const store = await cookies();
  return createServerClient(url, publishableKey, { cookies: {
    getAll: () => store.getAll(),
    setAll(items) { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* proxy refreshes read-only renders */ } },
  } });
}
