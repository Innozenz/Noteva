"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Bouton de souscription.
 *
 * Ne transmet aucun tarif : le prix est décidé côté serveur. L'ancienne
 * version envoyait un `priceId` depuis le client, que la route utilisait tel
 * quel — n'importe qui pouvait donc s'abonner au tarif de son choix.
 */
export function SubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const body = await response.json();

      if (!response.ok || !body.url) {
        setError(body?.error ?? "Une erreur est survenue");
        return;
      }

      window.location.href = body.url;
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        onClick={onClick}
        disabled={isLoading}
        variant="success"
        size="lg"
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        S&apos;abonner maintenant
      </Button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
