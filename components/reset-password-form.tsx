"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Même exigence qu'à l'inscription : un seuil différent ici serait incohérent. */
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères");

/**
 * Choix du nouveau mot de passe.
 *
 * Better Auth valide le jeton avant de rediriger ici : on le récupère dans
 * l'URL, ou une erreur si le lien était périmé ou déjà utilisé.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Lien invalide, périmé, ou déjà consommé : inutile d'afficher le formulaire.
  if (linkError || !token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-muted">
          Ce lien n&apos;est plus valable. Les liens expirent au bout d&apos;une
          heure et ne servent qu&apos;une fois.
        </p>
        <Button asChild>
          <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <p className="text-sm text-muted">
          Mot de passe modifié. Vos autres sessions ont été déconnectées.
        </p>
        <Button asChild>
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }

  const submit = async () => {
    const parsed = passwordSchema.safeParse(password);

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: authError } = await authClient.resetPassword({
      newPassword: parsed.data,
      token,
    });

    setIsLoading(false);

    if (authError) {
      setError(
 "Ce lien n'est plus valable. Demandez-en un nouveau depuis la page de connexion."
      );
      return;
    }

    setDone(true);
    router.refresh();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Changer mon mot de passe
      </Button>
    </form>
  );
}
