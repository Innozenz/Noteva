"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Failure } from "@/lib/http/failure";

/**
 * Affichage d'un échec dans un formulaire.
 *
 * Ne propose une action que lorsqu'il y en a une : « réessayer » sur une erreur
 * de saisie ferait tourner l'utilisateur en rond, et une session expirée demande
 * d'aller ailleurs avant de pouvoir réussir.
 *
 * Le lien de reconnexion ouvre un **nouvel onglet**, et c'est le point
 * important : rediriger la page en cours effacerait tout ce que l'utilisateur
 * vient de saisir. Une session qui expire pendant qu'on remplit un formulaire
 * ne doit pas coûter le formulaire.
 */
export function FormFailure({
  failure,
  onRetry,
}: {
  failure: Failure | null;
  onRetry?: () => void;
}) {
  if (!failure) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-danger-soft px-3 py-2"
    >
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        {failure.message}
      </p>

      {failure.needsSignIn ? (
        <Button size="sm" variant="outline" asChild>
          <Link href="/connexion" target="_blank" rel="noopener noreferrer">
            Se reconnecter
          </Link>
        </Button>
      ) : failure.canRetry && onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
