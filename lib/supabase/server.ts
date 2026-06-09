import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Создаёт новый экземпляр Supabase-клиента для серверного кода (Route Handlers, Server Components).
 * ВАЖНО: вызывать на каждый запрос (per-request pattern) — @supabase/ssr требует свежий клиент.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignore — вызов set() из Server Component запрещён в App Router,
            // но в Route Handlers это безопасно. Подавляем, чтобы не падать.
          }
        },
      },
    },
  );
}
