import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateSignUp } from "@/lib/auth/validation";
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

  const validation = validateSignUp(body);
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 },
    );
  }
  const { email, password } = validation.value;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    let msg = "Не удалось зарегистрироваться";
    if (
      error.code === "user_already_exists" ||
      /already.*registered/i.test(error.message)
    ) {
      msg = "Пользователь с таким email уже зарегистрирован";
    } else if (error.code === "validation_failed") {
      msg = "Некорректный email или пароль";
    } else if (
      error.code === "email_signups_disabled" ||
      /signups are disabled/i.test(error.message)
    ) {
      msg =
        "Регистрация по email отключена на стороне Supabase. Включите её в Dashboard → Authentication → Sign In/Up → Allow new users to sign up.";
    } else if (
      error.code === "email_address_not_authorized" ||
      /email.*not.*authorized/i.test(error.message)
    ) {
      msg =
        "Этот email не входит в список разрешённых на стороне Supabase. Добавьте его в Authentication → Sign In/Up → Allowed Email Addresses.";
    } else if (error.message) {
      msg = error.message;
    }
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json(
      { success: false, error: "Не удалось зарегистрироваться" },
      { status: 400 },
    );
  }

  // Если в Supabase включено "Confirm email", сразу после signUp сессия не выдаётся.
  // В этом случае логиним пользователя по тем же email/паролю — аккаунт уже создан,
  // пароль валидный, и пользователь сразу попадает в систему без подтверждения.
  let session = data.session;
  if (!session) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Регистрация выполнена, но автоматический вход не удался. Попробуйте войти вручную.",
        },
        { status: 400 },
      );
    }
    session = signInData.session;
  }

  // Профиль создаётся триггером, но на всякий случай — запасной путь через RPC
  const { data: profile, error: profileError } =
    await supabase.rpc("get_my_profile");
  if (profileError || !profile || profile.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Профиль не создан. Попробуйте войти через секунду.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: session.user.id,
      email: session.user.email ?? email,
    },
    profile: {
      email: profile[0].email,
      credits: profile[0].credits,
    },
  });
}
