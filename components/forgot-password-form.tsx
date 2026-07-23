"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { z } from "zod";

import { FormFailure } from "@/components/form-failure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authFailure } from "@/lib/auth-errors";
import { localFailure, type Failure } from "@/lib/http/failure";

const emailSchema = z.string().email("Adresse e-mail invalide");

/**
 * Demande de réinitialisation.
 *
 * La réponse est **toujours la même**, que l'adresse existe ou non. Afficher
 * « compte inconnu » transformerait ce formulaire en outil pour savoir qui est
 * inscrit sur Noteva.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const parsed = emailSchema.safeParse(email);

    if (!parsed.success) {
      setError(localFailure(parsed.error.issues[0].message));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: parsed.data,
        redirectTo: "/reinitialiser-mot-de-passe",
      });

      // Une erreur ici est technique (service indisponible), pas « adresse
      // inconnue » : Better Auth répond succès dans tous les cas.
      if (authError) {
        setError(authFailure({ error: authError }));
        return;
      }

      setSent(true);
    } catch (caught) {
      // `authClient` **rejette** quand le réseau lâche. Sans ce catch, le
      // `setIsLoading(false)` placé après l'await n'était jamais atteint et le
      // bouton restait en chargement indéfiniment, sans message.
      setError(authFailure({ caught }));
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-success" />
        <p className="text-sm text-muted">
          Si un compte existe avec cette adresse, un lien de réinitialisation
          vient d&apos;y être envoyé. Il est valable une heure.
        </p>
        <p className="text-sm text-muted">
          Pensez à regarder vos indésirables.
        </p>
        <Button variant="outline" asChild>
          <Link href="/connexion">Retour à la connexion</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="nom@exemple.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!error}
        />
      </div>

      <FormFailure failure={error} />

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Envoyer le lien
      </Button>

      <Link
        href="/connexion"
        className="text-center text-sm text-muted hover:underline"
      >
        Retour à la connexion
      </Link>
    </form>
  );
}
