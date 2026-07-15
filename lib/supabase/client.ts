"use client";
import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "./config.ts";
let instance: ReturnType<typeof createBrowserClient> | undefined;
export function createClient() {
  if (instance) return instance;
  const { url, publishableKey } = requireSupabasePublicConfig();
  instance = createBrowserClient(url, publishableKey);
  return instance;
}
