"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { FormFailure } from "@/components/form-failure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFailure } from "@/lib/auth-errors";
import { type Failure } from "@/lib/http/failure";
import { LogOut, Loader2 } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

type FieldErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function AuthButtons() {
  const session = authClient.useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);

  if (session.isPending) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (session.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <p className="text-sm text-muted">Connecté en tant que</p>
          <p className="font-medium">{session.data.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await authClient.signOut();
              router.refresh();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>
    );
  }

  const validateField = (field: "email" | "password", value: string) => {
    const result = authSchema.shape[field].safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? undefined : result.error.issues[0].message,
    }));
  };

  const handleEmailAuth = async () => {
    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as "email" | "password";
        fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setFailure(null);
    setIsLoading(true);

    // Le message de Better Auth est en anglais (« Invalid email or password »)
    // et c'est ce que lisait l'utilisateur. On passe par le `code`, stable, que
    // `authFailure` traduit.
    const onError = (ctx: { error: { status?: number; code?: string } }) =>
      setFailure(authFailure({ error: ctx.error }));

    try {
      if (isSignUp) {
        await authClient.signUp.email(
          { email, password, name: email.split("@")[0] },
          { onSuccess: () => router.refresh(), onError }
        );
      } else {
        await authClient.signIn.email(
          { email, password },
          { onSuccess: () => router.refresh(), onError }
        );
      }
    } catch (caught) {
      // Il y avait un `finally` mais pas de `catch` : sur coupure réseau le
      // bouton se débloquait et rien ne s'affichait. `authClient` rejette dans
      // ce cas — vérifié contre un port fermé.
      setFailure(authFailure({ caught }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => validateField("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email ? (
            <p className="text-sm text-danger">{errors.email}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={(e) => validateField("password", e.target.value)}
            aria-invalid={!!errors.password}
          />
          {errors.password ? (
            <p className="text-sm text-danger">{errors.password}</p>
          ) : null}
        </div>
        <FormFailure failure={failure} />
        <Button onClick={handleEmailAuth} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isSignUp ? "S'inscrire" : "Se connecter"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp
            ? "Déjà un compte ? Se connecter"
            : "Pas de compte ? S'inscrire"}
        </Button>
        {/* Sans ce lien, la réinitialisation n'est atteignable qu'en
            connaissant son URL. */}
        {!isSignUp ? (
          <Link
            href="/mot-de-passe-oublie"
            className="text-center text-sm text-muted hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        ) : null}
    </div>
  );
}
