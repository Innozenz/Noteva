"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

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
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const parsed = emailSchema.safeParse(email);

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: authError } = await authClient.requestPasswordReset({
      email: parsed.data,
      redirectTo: "/reinitialiser-mot-de-passe",
    });

    setIsLoading(false);

    // Une erreur ici est technique (service indisponible), pas « adresse
    // inconnue » : Better Auth répond succès dans tous les cas.
    if (authError) {
      setError("Envoi impossible pour le moment. Réessayez dans un instant.");
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-green-600" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Si un compte existe avec cette adresse, un lien de réinitialisation
          vient d&apos;y être envoyé. Il est valable une heure.
        </p>
        <p className="text-sm text-zinc-500">
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
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Envoyer le lien
      </Button>

      <Link
        href="/connexion"
        className="text-center text-sm text-zinc-500 hover:underline"
      >
        Retour à la connexion
      </Link>
    </form>
  );
}
