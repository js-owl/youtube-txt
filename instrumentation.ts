/**
 * Next.js instrumentation hook. Вызывается при старте каждого runtime
 * (nodejs + edge) — поэтому важно фильтровать по NEXT_RUNTIME.
 *
 * Локальный фикс: если в .env.local выставлен USE_PUBLIC_DNS=1 и мы в
 * nodejs-рантайме, переключаем DNS-резолвер на публичные серверы
 * (1.1.1.1, 8.8.8.8). Это решает проблему, когда системный DNS
 * (корпоративный / VPN) не резолвит домены *.supabase.co из Node-процесса.
 *
 * На проде эту переменную НЕ включаем — там DNS настраивается инфраструктурно.
 */
export async function register() {
  // В Edge runtime нет node:dns — пропускаем (там DNS не используется напрямую,
  // fetch идёт через нативный резолвер браузера/воркера).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.USE_PUBLIC_DNS !== "1") return;

  const dns = await import("node:dns");
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
  // eslint-disable-next-line no-console
  console.log(
    "[instrumentation] DNS set to public resolvers: 1.1.1.1, 8.8.8.8",
  );
}
