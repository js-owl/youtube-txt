import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateSignIn } from "@/lib/auth/validation";
import type { AuthResponse } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse<AuthResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Некорректный JSON" },
      { status: 400 },
    );
  }

  const validation = validateSignIn(body);
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 },
    );
  }
  const { email, password } = validation.value;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Единое сообщение, чтобы не палить, существует ли аккаунт
    return NextResponse.json(
      { success: false, error: "Неверный email или пароль" },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } =
    await supabase.rpc("get_my_profile");
  if (profileError || !profile || profile.length === 0) {
    return NextResponse.json(
      { success: false, error: "Профиль не найден" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.session.user.id,
      email: data.session.user.email ?? email,
    },
    profile: {
      email: profile[0].email,
      credits: profile[0].credits,
    },
  });
}
