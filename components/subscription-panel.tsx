"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SubscriptionPanel({
  isActive,
  currentPeriodEnd,
  hasCustomer,
  isPublished,
  timezone,
  flash,
}: {
  isActive: boolean;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  isPublished: boolean;
  timezone: string;
  flash: "success" | "canceled" | null;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (kind: "checkout" | "portal") => {
    setBusy(kind);
    setError(null);

    try {
      const response = await fetch(`/api/stripe/${kind}`, { method: "POST" });
      const body = await response.json();

      if (!response.ok || !body.url) {
        setError(body?.error ?? "Une erreur est survenue");
        return;
      }

      window.location.href = body.url;
    } catch {
      setError("Impossible de contacter le serveur");
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Le retour de Stripe passe par l'URL : l'état réel, lui, arrive par
          webhook et peut avoir quelques secondes de retard. */}
      {flash === "success" && !isActive ? (
        <p className="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-950/30">
          Paiement enregistré. L&apos;activation peut prendre quelques
          secondes — rechargez la page si rien ne change.
        </p>
      ) : null}
      {flash === "canceled" ? (
        <p className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
          Paiement abandonné. Rien n&apos;a été prélevé.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>Abonnement</CardTitle>
              <Badge variant={isActive ? "success" : "secondary"}>
                {isActive ? "Actif" : "Inactif"}
              </Badge>
            </div>
            {isActive || hasCustomer ? (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => go("portal")}
              >
                {busy === "portal" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Gérer mon abonnement
              </Button>
            ) : null}
          </div>
          <CardDescription>
            L&apos;abonnement rend votre fiche visible des élèves. Les cours,
            eux, vous sont réglés directement : Noteva ne prend aucune
            commission.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {isActive ? (
            <>
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                {currentPeriodEnd
                  ? `Prochain renouvellement le ${new Date(currentPeriodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: timezone })}`
                  : "Abonnement en cours"}
              </div>

              {!isPublished ? (
                <p className="rounded-lg bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
                  Votre abonnement est actif mais votre fiche est en brouillon :
                  elle reste invisible tant que vous ne l&apos;avez pas publiée.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sans abonnement, votre fiche n&apos;apparaît ni dans la
                recherche ni à son adresse publique, même publiée.
              </p>

              <Separator />

              <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>— Fiche visible dans la recherche</li>
                <li>— Réservations en ligne sur vos disponibilités</li>
                <li>— Agenda et gestion des demandes</li>
                <li>— Aucune commission sur vos cours</li>
              </ul>

              <Button
                size="lg"
                disabled={busy !== null}
                onClick={() => go("checkout")}
              >
                {busy === "checkout" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                M&apos;abonner
              </Button>
            </>
          )}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
