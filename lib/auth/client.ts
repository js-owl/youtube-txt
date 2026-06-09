import type { AuthResponse, MeResponse } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Сервер вернул некорректный ответ");
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<AuthResponse>(res);
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<AuthResponse>(res);
}

export async function signOut(): Promise<{ success: true }> {
  const res = await fetch("/api/auth/signout", { method: "POST" });
  return parseJson<{ success: true }>(res);
}

export async function getMe(): Promise<MeResponse> {
  try {
    const res = await fetch("/api/auth/me", { method: "GET" });
    return await parseJson<MeResponse>(res);
  } catch {
    return { authenticated: false };
  }
}
