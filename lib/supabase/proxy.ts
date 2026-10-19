import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSuperadminStatus } from "@/lib/auth";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Refreshes the Supabase session and writes updated auth cookies to both
// the forwarded request and the outgoing response. Also gates /admin/*.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache-Control headers so CDNs never cache a response carrying a session.
          authHeaders = headers ?? {};
          Object.entries(authHeaders).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and the auth call below;
  // it triggers the token refresh.
  if (!isAdminPath(request.nextUrl.pathname)) {
    await supabase.auth.getClaims();
    return response;
  }

  const result = await getSuperadminStatus(supabase);
  if (result.status === "authorized") return response;

  const target = result.status === "unauthenticated" ? "/" : "/unauthorized";
  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Carry over any refreshed (or cleared) session cookies.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(authHeaders).forEach(([key, value]) =>
    redirect.headers.set(key, value),
  );
  return redirect;
}
