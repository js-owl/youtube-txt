# План тестирования проекта YouTube-Txt

## Цель

Полное end-to-end тестирование системы Supabase Auth + Credits в Next.js проекте
с использованием MCP chrome-devtools и curl-команд. Проверка по чек-листу из
`implementation_plan.md` (раздел [Testing]).

## Этапы

### 1. Подготовка окружения

- [ ] Проверить .env.local (URL, publishable key, Supadata, Gemini)
- [ ] Убедиться, что зависимости установлены (@supabase/ssr, @supabase/supabase-js)
- [ ] Запустить dev-сервер `pnpm dev` (фоном)
- [ ] Проверить, что Supabase миграция применена (через запрос в БД)

### 2. Проверка TypeScript и сборки

- [ ] `pnpm tsc --noEmit` — не должно быть ошибок типов

### 3. Smoke-test API через curl

- [ ] `POST /api/auth/signup` с новым email → 200, credits = 5
- [ ] `GET /api/auth/me` (с cookies) → authenticated: true
- [ ] `POST /api/summarize` для guest → 401 AUTH_REQUIRED
- [ ] `POST /api/summarize` для authed → 200, success: true (xITLHyM1TUM)
- [ ] `GET /api/auth/me` → credits уменьшились
- [ ] `POST /api/auth/signout` → 200
- [ ] `GET /api/auth/me` → authenticated: false
- [ ] `POST /api/auth/signin` с теми же кред → 200, credits сохранён
- [ ] `POST /api/auth/signup` с тем же email → ошибка
- [ ] `POST /api/auth/signup` с коротким паролем → 400

### 4. E2E тест через chrome-devtools

- [ ] Открыть localhost:3000 в браузере
- [ ] Гость: видна кнопка "Войти / Создать аккаунт"
- [ ] Регистрация: открыть диалог → вкладка "Регистрация" → submit
- [ ] Проверить карточку с email и 5 кредитами в шапке
- [ ] Саммари: вставить URL → "Создать" → проверить ResultCard
- [ ] Проверить, что в шапке теперь 4 кредита
- [ ] Списание до нуля: повторить 4 раза, проверить 402 NO_CREDITS
- [ ] Сессия: refresh страницы → карточка сохраняется
- [ ] Выход: карточка пропадает, появляется кнопка входа
- [ ] Саммари после выхода блокируется
- [ ] Вход: повторный вход → карточка восстанавливается
- [ ] Повторный email → ошибка в диалоге
- [ ] Короткий пароль → ошибка валидации
- [ ] Edge: Escape закрывает диалог
- [ ] Edge: Enter в password сабмитит

### 5. Проверка БД (через SQL)

- [ ] `select * from public.profiles;` — записи корректны
- [ ] `select id, email from auth.users;` — пользователи есть
- [ ] `select credits from public.profiles;` — корректный баланс

### 6. Проверка консоли

- [ ] В DevTools Console нет красных ошибок после полного сценария

### 7. Production build

- [ ] `pnpm build` — успешная сборка
