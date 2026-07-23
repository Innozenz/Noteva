import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Music4 } from "lucide-react";

import { OnboardingChoice } from "@/components/onboarding-choice";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Bienvenue sur Noteva",
  robots: { index: false },
};

/**
 * Écran de choix du rôle.
 *
 * Server Component : le rôle se lit en base, pas dans la session. Le
 * middleware ne peut pas faire ce contrôle — il ne voit que la présence d'un
 * cookie et n'a pas accès à Prisma depuis l'edge.
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });

  // Le choix est définitif : repasser ici une fois le rôle posé n'a pas de sens.
  if (user?.role) {
    redirect("/dashboard");
  }

  const firstName = user?.name?.trim().split(" ")[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      {/* L'écran n'avait ni logo ni sortie : un compte créé via Google qui
          n'arrivait pas à choisir s'y retrouvait enfermé, tout l'espace
          connecté renvoyant ici tant que le rôle est nul. */}
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold"
      >
        <Music4 className="h-5 w-5 text-primary" />
        Noteva
      </Link>

      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {firstName ? `Bienvenue ${firstName}` : "Bienvenue"}
        </h1>
        <p className="text-muted">
          Dernière étape : dites-nous ce que vous venez faire sur Noteva.
        </p>
      </div>

      <OnboardingChoice />
    </main>
  );
}
