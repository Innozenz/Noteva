import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/onboarding"];
// `/connexion` gère elle-même la redirection d'un utilisateur déjà connecté :
// elle a besoin du rôle, et le proxy ne lit pas la base — il s'en tient au
// cookie, sans requête DB à chaque requête interceptée.
const authRoutes: string[] = [];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Passer par le helper de Better Auth, et pas lire « better-auth.session_token »
  // en dur : en HTTPS, Better Auth préfixe le cookie en « __Secure-… ». Le nom
  // codé en dur marchait en localhost (HTTP, sans préfixe) mais échouait en
  // prod — le proxy croyait alors l'utilisateur déconnecté, redirigeait vers
  // /connexion qui, elle, trouvait bien la session et renvoyait vers /dashboard :
  // boucle de redirection infinie. `getSessionCookie` ne lit que le cookie
  // (aucune requête DB), il vérifie juste sa présence.
  const sessionToken = getSessionCookie(request);

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
