import { notFound } from "next/navigation";

import { AdminTabs } from "@/components/admin-tabs";
import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/admin/session";
import prisma from "@/lib/prisma";

/**
 * Espace d'administration.
 *
 * Troisième porte du même modèle que /dashboard et /dashboard/prof : un Server
 * Component qui lit le rôle en base. Le proxy pourrait le lire aussi (runtime
 * Node sous Next 16, plus edge-only), mais une lecture DB à chaque requête
 * interceptée n'a pas sa place là : le layout est le bon endroit.
 *
 * `notFound()` plutôt qu'une redirection : pour qui n'est pas administrateur,
 * cette zone n'existe pas. Une redirection lui apprendrait qu'il y a quelque
 * chose ici.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  if (!admin.ok) notFound();

  // `requireAdmin` ne rend que l'identifiant — il sert aussi aux routes d'API,
  // qui n'ont que faire d'un nom d'affichage.
  // Le rôle voyage avec l'identité : un admin peut aussi être prof ou élève,
  // et l'en-tête l'utilise pour savoir où renvoie « chez soi ».
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: admin.userId },
    select: { name: true, email: true, image: true, role: true },
  });

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader
        role={user.role}
        isAdmin
        user={{ name: user.name, email: user.email, image: user.image }}
      />

      <header className="border-b border-border bg-white">
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
