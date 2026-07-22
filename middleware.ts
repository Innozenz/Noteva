import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/onboarding"];
// `/connexion` gère elle-même la redirection d'un utilisateur déjà connecté :
// elle a besoin du rôle, que le middleware ne peut pas lire depuis l'edge.
const authRoutes: string[] = [];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !sessionToken) {
    const loginUrl = new URL("/connexion", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
