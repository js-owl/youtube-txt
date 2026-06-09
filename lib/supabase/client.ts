import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton для браузерного Supabase-клиента. Через globalThis — HMR-устойчиво.
 */
declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowser: SupabaseClient | undefined;
}

export function createBrowserSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createBrowserSupabase() вызван на сервере");
  }

  if (!globalThis.__supabaseBrowser) {
    globalThis.__supabaseBrowser = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }

  return globalThis.__supabaseBrowser;
}
