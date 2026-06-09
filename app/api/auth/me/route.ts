import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MeResponse } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<MeResponse>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const { data: profile, error } = await supabase.rpc("get_my_profile");
  if (error || !profile || profile.length === 0) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? "",
    },
    profile: {
      email: profile[0].email,
      credits: profile[0].credits,
    },
  });
}
