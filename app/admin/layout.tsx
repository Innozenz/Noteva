import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Star } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/admin/session";

/**
 * Espace d'administration.
 *
 * Troisième porte du même modèle que /dashboard et /dashboard/prof : un Server
 * Component qui lit le rôle en base, parce que le middleware ne le peut pas
 * depuis l'edge.
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

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader role="ADMIN" />

      <header className="border-b border-border bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-1 px-4">
          <span className="flex items-center gap-2 py-4 pr-4 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Administration
          </span>
          <Link
            href="/admin/avis"
            className="flex items-center gap-2 border-b-2 border-primary px-4 py-4 text-sm font-medium"
          >
            <Star className="h-4 w-4" />
            Avis
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
