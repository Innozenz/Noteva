import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Music4 } from "lucide-react";

import { OnboardingChoice } from "@/components/onboarding-choice";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { givenName } from "@/lib/user/name";

export const metadata: Metadata = {
  title: "Bienvenue sur SiNote",
  robots: { index: false },
};

/**
 * Écran de choix du rôle.
 *
 * Server Component : le rôle se lit en base, pas dans la session. Le proxy ne
 * fait pas ce contrôle — non qu'il ne le puisse pas (sous Next 16 il tourne sur
 * Node, plus seulement l'edge), mais une lecture DB à chaque requête
 * interceptée n'y a pas sa place ; il s'en tient à la présence d'un cookie.
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, firstName: true },
  });

  // Le choix est définitif : repasser ici une fois le rôle posé n'a pas de sens.
  if (user?.role) {
    redirect("/dashboard");
  }

  const firstName = user ? givenName(user) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      {/* L'écran n'avait ni logo ni sortie : un compte fraîchement créé qui
          n'arrivait pas à choisir s'y retrouvait enfermé, tout l'espace
          connecté renvoyant ici tant que le rôle est nul. */}
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold"
      >
        <Music4 className="h-5 w-5 text-primary" />
        SiNote
      </Link>

      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {firstName ? `Bienvenue ${firstName}` : "Bienvenue"}
        </h1>
        <p className="text-muted">
          Dernière étape : dites-nous ce que vous venez faire sur SiNote.
        </p>
      </div>

      <OnboardingChoice />
    </main>
  );
}
