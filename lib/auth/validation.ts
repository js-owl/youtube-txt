/**
 * Простая ручная валидация, без зависимости на zod.
 * Достаточно для регистрации/входа: email + password ≥ 8 символов.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateSignUp(
  input: unknown,
): ValidationResult<{ email: string; password: string }> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Некорректный формат запроса" };
  }
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    return { ok: false, error: "Введите email" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Некорректный email" };
  }
  if (!password) {
    return { ok: false, error: "Введите пароль" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
    };
  }
  return { ok: true, value: { email, password } };
}

export function validateSignIn(
  input: unknown,
): ValidationResult<{ email: string; password: string }> {
  return validateSignUp(input); // правила одинаковые
}
