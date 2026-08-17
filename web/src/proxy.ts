import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Handle locale cookie initialization if missing
  let locale = request.cookies.get("bb-locale")?.value;
  if (!locale) {
    const acceptLang = request.headers.get("accept-language") || "";
    locale = acceptLang.includes("ur") ? "ur" : "en";
    response.cookies.set("bb-locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  // Public & unauthenticated allowed routes
  const isAuthRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/forgot-password");

  // The design lab renders unfinished screens off fixture data. It is a
  // development surface and was reachable signed-out in production.
  const isLabRoute = pathname.startsWith("/lab");
  if (isLabRoute && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  // `/api` stays public because Meta's webhook has no session to present. It
  // authenticates itself by HMAC signature inside the route instead.
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/auth/callback") ||
    isLabRoute ||
    pathname.startsWith("/api");

  // Root redirect
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/sign-in";
    return NextResponse.redirect(url);
  }

  // Auth protection for private routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated user away from sign-in / sign-up to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

