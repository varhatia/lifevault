import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/api/auth";

// Protect authenticated app routes and redirect unauthenticated users to login
// on the server side to avoid flicker on the client.

const PROTECTED_PATHS = ["/my-vault", "/family-vault", "/nominee", "/nominee-vault"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((base) =>
    pathname === base || pathname.startsWith(`${base}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasAuthCookie = !!req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!hasAuthCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/my-vault/:path*",
    "/family-vault/:path*",
    "/nominee/:path*",
    "/nominee-vault/:path*",
  ],
};


