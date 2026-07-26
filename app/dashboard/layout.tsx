import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Porte d'entrée de l'espace connecté.
 *
 * C'est ici, et pas dans le middleware, que se fait le contrôle du rôle : le
 * middleware s'exécute sur l'edge, ne voit que la présence du cookie de
 * session et n'a pas accès à Prisma. Un Server Component peut lire la base,
 * donc rediriger vers l'onboarding tant que `role` est nul.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  // L'identité voyage avec le rôle : l'en-tête l'affiche, et la lire ici plutôt
  // que côté client évite à la fois une requête et un nom périmé après un
  // changement sur /dashboard/compte.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, email: true, image: true },
  });

  if (!user?.role) {
    redirect("/onboarding");
  }

  return (
    <>
      {/* Porte l'identité et la sortie. L'ancien bandeau ne disait que
          « Compte prof » et pointait vers l'espace : ni logo, ni retour vers le
          site public, ni déconnexion, et l'espace prof empilait donc deux
          barres anonymes. */}
      <AppHeader
        role={user.role}
        user={{ name: user.name, email: user.email, image: user.image }}
      />
      {children}
    </>
  );
}
