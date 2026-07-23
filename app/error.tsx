"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Limite d'erreur de l'application.
 *
 * Sans ce fichier, une exception dans un Server Component affichait la page par
 * défaut de Next : en production, un « Application error: a server-side
 * exception has occurred » en anglais, sans mise en forme et sans aucun lien
 * pour repartir. Sur un service francophone, c'est la pire panne possible —
 * elle donne l'impression que le site n'existe plus.
 *
 * `reset()` refait le rendu du segment sans recharger la page. Beaucoup
 * d'erreurs sont transitoires — une requête qui a expiré, une base
 * momentanément injoignable — et un simple nouvel essai suffit.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Le `digest` est le seul lien entre ce que voit l'utilisateur et la trace
    // côté serveur : en production, le message réel n'est pas transmis au
    // navigateur.
    console.error("[APP_ERROR]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-warning" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">Quelque chose s&apos;est mal passé</h1>
        <p className="text-muted">
          L&apos;incident est de notre côté, pas du vôtre. Réessayer suffit le
          plus souvent.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>

      {/* Affiché parce qu'il sert au support : c'est la seule référence que
          l'utilisateur peut citer, et elle ne divulgue rien. */}
      {error.digest ? (
        <p className="text-xs text-subtle">
          {`Référence de l'incident : ${error.digest}`}
        </p>
      ) : null}
    </main>
  );
}
