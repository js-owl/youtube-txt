# Implementation Plan: Supabase Auth + Credits

[Reference]

**Supabase project (уже создан):**

- Project ID: `tnewmooaoytxvupzzyga`
- Project URL: `https://tnewmooaoytxvupzzyga.supabase.co`
- Region: `eu-north-1`
- Status: `ACTIVE_HEALTHY`
- Organization: `sowl` (`chtqbaucliafshfuvkmc`)
- Publishable key (новый формат): `sb_publishable_A3lxeb91IjabfkM2GBd-UA_FA8E8V-L`
- Legacy anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZXdtb29hb3l0eHZ1cHp6eWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzY0NjgsImV4cCI6MjA5NjUxMjQ2OH0.QHXbaI5EhmCAXdG916WENtwdQe4Mav2CDUJB0zkkOFI` (используем только в крайнем случае, рекомендован publishable)

**Текущая БД:** пустая (миграций нет, таблиц нет).

**Безопасность:** значения ключей **никогда** не пишем в исходники/план/коммиты. Только в `.env.local` (он в `.gitignore`). Publishable-ключ безопасно светить в клиентском бандле, но всё равно кладём его в env, чтобы ротировать без правок кода.

**Email-подтверждение:** по требованию пользователя — отключено. Функционал подтверждения почты будет добавлен позднее отдельной задачей. Текущая регистрация ожидает, что `signUp` сразу возвращает сессию. Если в Supabase включено подтверждение — сессия не придёт и пользователю нужно снять «Confirm email» вручную в Dashboard.

**Эталонное видео для тестирования (добавил пользователь):**

- `https://www.youtube.com/watch?v=xITLHyM1TUM` — ID `xITLHyM1TUM`. Используем как основной happy-path наравне с `kJQP7kiw5Fk`. Ожидаемо: 200, `ResultCard` с реальными данными, списание 1 кредита. Этот ID должен попасть в `cURL`-сценарии и в `chrome-devtools` E2E-тест в разделе [Testing].

[Overview]

Добавить в существующий Next.js-проект (App Router, React 19, TS) систему регистрации/входа через Supabase Auth и кредитную систему (5 кредитов на старте, −1 за каждое саммари). Бэкенд — Route Handlers внутри Next.js (`/api/auth/signup|signin|signout|me`) на `@supabase/ssr` с безопасной работой с cookies. Баланс хранится в таблице `profiles`, атомарное списание — через `SECURITY DEFINER` RPC `consume_credit` (защита от гонок). Существующий `POST /api/summarize` интегрируется: списывает кредит, при ошибке возвращает. На фронте — кнопка «Войти / Создать аккаунт» (для гостей) и email+баланс+«Выйти» (для залогиненых), плюс модалка входа/регистрации.

[Types]

**`lib/supabase/types.ts` (новый)** — тип профиля:

```ts
export type Profile = {
  id: string; // uuid = auth.users.id
  email: string;
  credits: number; // целое >= 0
  created_at: string;
  updated_at: string;
};
```

**`lib/auth/types.ts` (новый)** — DTO для API:

```ts
export type SignUpRequest = { email: string; password: string };
export type SignInRequest = { email: string; password: string };

export type AuthSuccessResponse = {
  success: true;
  user: { id: string; email: string };
  profile: { email: string; credits: number };
};

export type AuthErrorResponse = {
  success: false;
  error: string;
  code?: string;
};
export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

export type MeResponse =
  | {
      authenticated: true;
      user: { id: string; email: string };
      profile: { email: string; credits: number };
    }
  | { authenticated: false };
```

**`SummarizeError` (расширение):** добавляем `code?: 'AUTH_REQUIRED' | 'NO_CREDITS' | ...`.

[Files]

**Новые файлы:**

- `lib/supabase/server.ts` — `createServerSupabase()`: per-request `createServerClient` с `cookies()` из `next/headers`.
- `lib/supabase/client.ts` — `createBrowserSupabase()`: `createBrowserClient` (singleton через `globalThis` для HMR).
- `lib/supabase/middleware.ts` — `updateSession(request)`: refresh токенов (из доки `@supabase/ssr`).
- `lib/supabase/types.ts` — тип `Profile`.
- `lib/auth/types.ts` — DTO.
- `lib/auth/client.ts` — клиентские хелперы: `signUp`, `signIn`, `signOut`, `getMe` (тонкие обёртки над `fetch` к `/api/auth/*`).
- `lib/auth/validation.ts` — zod-схемы `SignUpSchema`, `SignInSchema` (email, password ≥ 8).
- `middleware.ts` (в корне) — вызывает `updateSession`, matcher исключает статику.
- `app/api/auth/signup/route.ts` — POST: валидация → `signUp` → `get_my_profile` → ответ.
- `app/api/auth/signin/route.ts` — POST: валидация → `signInWithPassword` → `get_my_profile` → ответ.
- `app/api/auth/signout/route.ts` — POST: `signOut` → 200.
- `app/api/auth/me/route.ts` — GET: `getUser` → профиль или `{ authenticated: false }`.
- `components/auth-dialog.tsx` — модалка (overlay + card) с вкладками «Вход» / «Регистрация». Поля email+password, submit, переключатель, ошибки, Escape-закрытие, клик по overlay.
- `components/auth-button.tsx` — client component: тянет `/api/auth/me`. Если гость → кнопка «Войти / Создать аккаунт». Если залогинен → карточка: иконка, email, «💎 N кредитов», icon-button «Выйти». При `onAuthChange` перезапрашивает `/me`.
- `supabase/migrations/20260609000000_init_auth_and_credits.sql` — таблица `profiles`, RLS, триггер на `auth.users insert`, RPC `consume_credit`/`refund_credit`/`get_my_profile`.

**Изменяемые файлы:**

- `package.json` — добавить `@supabase/supabase-js` и `@supabase/ssr` (через `pnpm add`).
- `.env.example` — добавить `NEXT_PUBLIC_SUPABASE_URL=` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`.
- `components/summarizer.tsx` — рендерить `<AuthButton />` над заголовком. Блокировать «Создать» если `!authenticated || credits === 0`, подсказки. Обрабатывать `SummarizeError.code` (`AUTH_REQUIRED`, `NO_CREDITS`).
- `app/api/summarize/route.ts` — в начале: `getUser` → 401 `AUTH_REQUIRED`; затем `rpc('consume_credit')` → 402 `NO_CREDITS`; в `catch` после успешного consume → `rpc('refund_credit')`.
- `lib/summarize-client.ts` — добавить `code?: string` в `SummarizeError`.

**Удаляемые файлы:** нет.

[Functions]

**Новые:**

1. `lib/supabase/server.ts` — `createServerSupabase(): Promise<SupabaseClient>` (per-request, `cookies().getAll/setAll`).
2. `lib/supabase/client.ts` — `createBrowserSupabase(): SupabaseClient` (singleton через `globalThis`).
3. `lib/supabase/middleware.ts` — `updateSession(request: NextRequest): Promise<NextResponse>`.
4. `middleware.ts` — `middleware(request)`, matcher `['/((?!_next/static|_next/image|favicon.ico|images/.*|icon.*).*)']`.
5. `lib/auth/validation.ts` — `SignUpSchema`, `SignInSchema` (zod).
6. `lib/auth/client.ts` — `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `getMe()` — тонкие fetch-обёртки.
7. `app/api/auth/signup/route.ts` — `POST(req)`. Шаги: parse → zod → `supabase.auth.signUp({ email, password })` → если `error`, маппинг кодов (`user_already_exists` → «Пользователь с таким email уже зарегистрирован», иначе общее «Не удалось зарегистрироваться») → `rpc('get_my_profile')` → ответ.
8. `app/api/auth/signin/route.ts` — `POST(req)`. Шаги: parse → zod → `signInWithPassword` → ошибка → «Неверный email или пароль» (единое сообщение) → `get_my_profile` → ответ.
9. `app/api/auth/signout/route.ts` — `POST()`. `signOut()` → 200 `{ success: true }`.
10. `app/api/auth/me/route.ts` — `GET()`. `getUser` → нет/ошибка → 200 `{ authenticated: false }`. Иначе → `get_my_profile` → `{ authenticated: true, ... }`.
11. `app/api/summarize/route.ts` — модификация (см. ниже).
12. `components/auth-dialog.tsx` — `AuthDialog({ open, onOpenChange, onAuthChange })`. Стейт: `mode: 'signin' | 'signup'`, `email`, `password`, `error`, `loading`. Escape + click-outside закрывает. На успех вызывает `onAuthChange()` и `onOpenChange(false)`.
13. `components/auth-button.tsx` — `AuthButton()`. Стейт: `status: 'loading' | 'guest' | 'authed'`. На маунт → `getMe()`. Рендер: гость — кнопка «Войти / Создать аккаунт» (открывает диалог); залогинен — карточка с email/балансом/icon-кнопкой выхода. Выход → `signOut()` → рефетч.
14. `supabase/migrations/20260609000000_init_auth_and_credits.sql` — DDL/DML:
    - `create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text not null, credits int not null default 5 check (credits >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now())`.
    - `alter table public.profiles enable row level security`.
    - `create policy "select own profile" on public.profiles for select using (auth.uid() = id)`.
    - `create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and credits >= 0)`.
    - `create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id, email) values (new.id, new.email); return new; end; $$;`.
    - `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`.
    - `create or replace function public.consume_credit() returns boolean language plpgsql security definer set search_path = public as $$ declare ok boolean; begin update public.profiles set credits = credits - 1, updated_at = now() where id = auth.uid() and credits > 0 returning true into ok; return coalesce(ok, false); end; $$;`.
    - `create or replace function public.refund_credit() returns void language plpgsql security definer set search_path = public as $$ begin update public.profiles set credits = credits + 1, updated_at = now() where id = auth.uid() and credits < 2147483647; end; $$;`.
    - `create or replace function public.get_my_profile() returns table(email text, credits int) language sql security definer set search_path = public as $$ select email, credits from public.profiles where id = auth.uid(); $$;`.
    - `grant execute on function public.consume_credit() to authenticated;` (аналогично для `refund_credit`, `get_my_profile`).
    - `grant select, update on public.profiles to authenticated;`.

**Модифицированные:**

- `app/api/summarize/route.ts` — в самом начале `POST`:
  1. `const supabase = await createServerSupabase();`
  2. `const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ success: false, error: 'Войдите, чтобы создавать саммари', code: 'AUTH_REQUIRED' }, { status: 401 });`
  3. `const { data: consumed } = await supabase.rpc('consume_credit'); if (!consumed) return NextResponse.json({ success: false, error: 'Закончились кредиты', code: 'NO_CREDITS' }, { status: 402 });`
  4. В `try/catch` основной работы: на любой ошибке после успешного consume — `await supabase.rpc('refund_credit');` (через `.catch(() => {})`, чтобы не маскировать оригинальную ошибку), затем return.
- `lib/summarize-client.ts` — `SummarizeError` получает поле `code?: string`; парсер пробрасывает `code` из ответа.
- `components/summarizer.tsx`:
  - Добавить в шапку `<AuthButton onAuthChange={refreshMe} />`.
  - Импортировать `useEffect` и `getMe` из `lib/auth/client`.
  - Локальный стейт: `authState: { status: 'loading' | 'guest' | 'authed', credits: number }`.
  - `useEffect` на маунт: `getMe()` → стейт.
  - В `handleSubmit` перед запросом: если `!authed` или `credits === 0` → `setErrorMessage(...)` и return.
  - В `catch` от `summarizeUrl`: если `err.code === 'AUTH_REQUIRED'` → «Войдите, чтобы создавать саммари»; `NO_CREDITS` → «Закончились кредиты»; иначе — общий текст.
  - После успешного `summarizeUrl` → `getMe()` (для актуализации баланса).

**Удаляемые функции:** нет.

[Classes]

**Новые:**

- `SummarizeError` (расширение в `lib/summarize-client.ts`) — добавить `code?: string` (опционально), хранить `code` в конструкторе.

Классов-обёрток для Supabase SDK не делаем: `@supabase/supabase-js` уже и так объектно-ориентированный, а `createServerSupabase` / `createBrowserSupabase` — функции-фабрики.

[Dependencies]

**Добавить (runtime):**

- `@supabase/supabase-js` — клиент Supabase, isomorphic API. Версия — последняя стабильная (`pnpm view @supabase/supabase-js version` на момент реализации; в плане пинов не делаем, фиксируем в lockfile).
- `@supabase/ssr` — обёртка для App Router, корректная работа с cookies и refresh токенов. Версия — последняя стабильная.

**Установка:** `pnpm add @supabase/supabase-js @supabase/ssr` (используем pnpm, так как `pnpm-lock.yaml` в репо).

**Никаких других пакетов:** zod опционально — если хочется валидацию на сервере, добавим `zod` (это +1 зависимость). Решение по умолчанию: используем **zod**, потому что ошибки валидации нужно возвращать пользователю осмысленно. Если zod не установлен — перейдём на ручную валидацию regex-ом.

[Testing]

**Подготовка (делается один раз):**

1. `pnpm add @supabase/supabase-js @supabase/ssr` (если берём zod — добавить `zod`).
2. Создать `.env.local` по образцу `.env.example` и вписать `NEXT_PUBLIC_SUPABASE_URL=https://tnewmooaoytxvupzya.supabase.co` (реальный URL) и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_A3lxeb91IjabfkM2GBd-UA_FA8E8V-L`. **Не коммитить.**
3. Применить миграцию через MCP Supabase (`apply_migration`).
4. **Важно:** в Supabase Dashboard → Authentication → Providers → Email должно быть выключено «Confirm email», иначе `signUp` не вернёт сессию. Функционал подтверждения почты будет добавлен позднее.

**Smoke-test через DevTools (MCP `chrome-devtools`):**

1. Запустить `pnpm dev`. Открыть `http://localhost:3000`.
2. **Гость:** убедиться, что на главной видна кнопка «Войти / Создать аккаунт». Снимок экрана (для истории).
3. **Регистрация:** кликнуть кнопку → открывается диалог → вкладка «Регистрация» → ввести уникальный email (например, `test+1@example.com`) + пароль ≥ 8 → submit. Ожидаемо: диалог закрывается, в шапке появляется карточка с email и «💎 5 кредитов». Снимок.
4. **БД-проверка:** `execute_sql` → `select * from public.profiles;` → видим одну запись с `credits = 5`. `select id, email from auth.users;` → видим пользователя.
5. **Саммари (эталонное, добавил пользователь):** вставить `https://www.youtube.com/watch?v=xITLHyM1TUM` → «Создать». Ожидаемо: 200, `ResultCard` с реальными данными, после — в шапке «💎 4 кредита». Снимок.
   **Альтернативное счастливое видео:** `https://www.youtube.com/watch?v=kJQP7kiw5Fk` (для повторных прогонов в случае отказа первого).
6. **БД после саммари:** `select credits from public.profiles;` → `4`.
7. **Списание до нуля:** повторить саммари ещё 4 раза (или вызвать `/api/summarize` через curl 4 раза). Ожидаемо: после 5-го раза — `402 { code: 'NO_CREDITS' }`, на UI — «Закончились кредиты».
8. **Сессия:** refresh страницы → карточка пользователя сохраняется (cookies работают). Открыть DevTools → Application → Cookies → видны `sb-…-auth-token`.
9. **Выход:** нажать «Выйти» → карточка пропадает, появляется кнопка «Войти / Создать аккаунт». Сессионные cookies очищены.
10. **Саммари после выхода:** попытка саммари → блокируется на UI (гость), или если curl напрямую — `401 AUTH_REQUIRED`.
11. **Вход:** повторно войти тем же email/паролем → карточка восстанавливается, `credits` тот же (4).
12. **Повторный email:** попытаться зарегистрироваться с тем же email → ошибка «Пользователь с таким email уже зарегистрирован».
13. **Плохой пароль:** попытаться зарегистрироваться с паролем 5 символов → 400 «Пароль должен быть не короче 8 символов».
14. **Refunds:** искусственно довести кредиты до 1 (вручную в БД), вызвать саммари на несуществующем видео → ждём ошибку от Supadata (например, `c9DIoSNoQNs` → 400). Проверить `credits` — должен быть всё ещё 1 (refund отработал).

**Гонки (опционально, если будет время):** параллельно вызвать `/api/summarize` 10 раз из консоли (на 5 кредитах). Ожидаемо: 5 успешных + 5 `NO_CREDITS`. Проверить: `credits = 0`, не отрицательное.

**Edge-cases:**

- Закрыть/открыть диалог — стейт должен сбрасываться.
- `Enter` в поле password в диалоге — должно сабмитить.
- `Escape` — закрывает диалог.

**Network/console:** в DevTools Console не должно быть красных ошибок. `chrome-devtools list_console_messages` после полного сценария — никаких `error`-уровня.

**Production-build:** `pnpm build` должен пройти без ошибок (Next.js + TS).

[Implementation Order]

1. **Установить зависимости:** `pnpm add @supabase/supabase-js @supabase/ssr zod` (если берём zod).
2. **Создать файлы Supabase:** `lib/supabase/server.ts`, `client.ts`, `middleware.ts`, `types.ts`. Сверить с докой `@supabase/ssr` (Context7).
3. **Создать `middleware.ts` в корне**, проверить, что matcher исключает статику, сессия обновляется.
4. **Создать миграцию `supabase/migrations/20260609000000_init_auth_and_credits.sql`** и применить через MCP `apply_migration` (с проектом `tnewmooaoytxvupzzyga`). Проверить результат: `list_tables` → видим `public.profiles`; `execute_sql` → триггер есть.
5. **Дополнить `.env.example`** и создать `.env.local` (вне git).
6. **Создать `lib/auth/types.ts`, `lib/auth/validation.ts`, `lib/auth/client.ts`**.
7. **Создать API-роуты** `app/api/auth/{signup,signin,signout,me}/route.ts`. В каждом — типизированный `try/catch`, понятные ошибки.
8. **Прогнать smoke-test API через curl:**
   - `POST /api/summarize` с `{"url":"https://www.youtube.com/watch?v=xITLHyM1TUM"}` (используя cookies от signin) → 200, `success: true`. Это первичная проверка happy-path (а не эталонного `kJQP7kiw5Fk`, т.к. пользователь явно попросил тестировать на `xITLHyM1TUM`).
   - `POST /api/auth/signup` с новым email → 200, в ответе `profile.credits = 5`.
   - `GET /api/auth/me` (с cookies от прошлого шага) → 200 `authenticated: true`.
   - `POST /api/auth/signout` → 200.
   - `GET /api/auth/me` → `authenticated: false`.
   - `POST /api/auth/signin` с теми же кред → 200, `credits` сохранён.
9. **Создать `components/auth-dialog.tsx`, `components/auth-button.tsx`**. Проверить в DevTools, что модалка открывается/закрывается, переключаются вкладки.
10. **Модифицировать `app/api/summarize/route.ts`:** добавить `createServerSupabase`, `getUser`, `consume_credit`, `refund_credit` в catch.
11. **Модифицировать `lib/summarize-client.ts`:** добавить `code` в `SummarizeError`.
12. **Модифицировать `components/summarizer.tsx`:** добавить `<AuthButton />`, блокировку submit, обработку кодов ошибок.
13. **Полный E2E-тест через `chrome-devtools`** по чек-листу Testing. Снимки экрана на ключевых шагах.
14. **Прогнать `pnpm tsc --noEmit`** — TypeScript не должен ругаться.
15. **Прогнать `pnpm build`** — продакшен-билд должен пройти.
16. **Закоммитить** (без `.env.local`, без ключей в коде). Готово к деплою (env-переменные проставить в Vercel перед деплоем).
