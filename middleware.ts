import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     * - images/* (наши статические картинки)
     * - icon.* (иконки)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|icon.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
