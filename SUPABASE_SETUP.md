# Supabase Auth + Credits — настройка

## Уже сделано

- Проект Supabase: `tnewmooaoytxvupzzyga` (eu-north-1, ACTIVE_HEALTHY)
- Применена миграция:
  - `20260609000000_init_auth_and_credits.sql` — таблица `profiles` с RLS, триггер на `auth.users` (5 кредитов), RPC `consume_credit` / `refund_credit` / `get_my_profile`.

## ⚠️ Обязательно включить вручную в Dashboard

Без этих настроек регистрация возвращает `400 — Email signups are disabled`, и пользователь не попадает в систему:

1. Откройте https://supabase.com/dashboard/project/tnewmooaoytxvupzzyga/auth/users
2. **Authentication → Sign In/Up (Providers → Email)**
   - ✅ **Allow new users to sign up** — должно быть включено.
   - ⬜ **Confirm email** — рекомендуется **выключить**, чтобы после `signUp` сразу выдавалась сессия и пользователь попадал в аккаунт без подтверждения почты.
3. (Опционально, для разработки) **Authentication → Sign In/Up → Allowed Email Addresses** — оставьте пустым, иначе придётся явно вписывать каждый тестовый email.

После включения перезапустите `pnpm dev` (если меняли настройки) и проверьте регистрацию.

## Шаги для запуска

### 1. `.env.local`

Создайте `.env.local` (он в `.gitignore`) по образцу `.env.example`:

```env
SUPADATA_API_KEY=...
GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://tnewmooaoytxvupzzyga.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_A3lxeb91IjabfkM2GBd-UA_FA8E8V-L
```

### 2. Запуск

```bash
pnpm install
pnpm dev
```

Откройте `http://localhost:3000`.

## Архитектура

- **Auth flow:**
  - `/api/auth/signup` — POST {email, password} → `supabase.auth.signUp` →
    - если `session` есть сразу — берём её;
    - если `session === null` (Confirm email включён) → fallback через `signInWithPassword` по тем же email/паролю. Аккаунт уже создан, пароль валидный, сессия выдаётся, куки прописываются. Так пользователь попадает в систему без подтверждения почты.
    - `get_my_profile` → `{success, user, profile}`.
  - `/api/auth/signin` — POST {email, password} → `signInWithPassword` → `get_my_profile` → `{success, user, profile}`.
  - `/api/auth/signout` — POST → `signOut` → `{success: true}`.
  - `/api/auth/me` — GET → `getUser` + `get_my_profile` → `{authenticated, user?, profile?}`.

- **Credits flow (атомарно, через RPC):**
  - При регистрации триггер `on_auth_user_created` создаёт запись в `public.profiles` с `credits = 5`.
  - `POST /api/summarize`:
    1. `supabase.auth.getUser()` → 401 `AUTH_REQUIRED` если нет.
    2. `rpc('consume_credit')` → 402 `NO_CREDITS` если кредитов нет.
    3. На любой ошибке после consume — `rpc('refund_credit')` (best-effort, не маскирует основную).

- **RLS:**
  - `select own profile` — пользователь видит только свой профиль.
  - `update own profile` — может менять, но `credits >= 0` (нельзя «обнулить» через UI).

- **Middleware:**
  - `middleware.ts` обновляет сессию (refresh токенов) на каждом запросе.

## API

| Метод | URL                 | Тело                | Успех                                    | Ошибки                                                               |
| ----- | ------------------- | ------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| POST  | `/api/auth/signup`  | `{email, password}` | 200 + `{success, user, profile}`         | 400 (валидация / `user_already_exists` / `email_signups_disabled`)   |
| POST  | `/api/auth/signin`  | `{email, password}` | 200 + `{success, user, profile}`         | 400 («Неверный email или пароль»)                                    |
| POST  | `/api/auth/signout` | —                   | 200 + `{success: true}`                  | —                                                                    |
| GET   | `/api/auth/me`      | —                   | 200 + `{authenticated, user?, profile?}` | —                                                                    |
| POST  | `/api/summarize`    | `{url}`             | 200 + `{success, data}`                  | 401 `AUTH_REQUIRED` / 402 `NO_CREDITS` / 400 / 429 / 500 / 502 / 504 |
