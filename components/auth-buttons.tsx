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
import { Separator } from "@/components/ui/separator";
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
    <div className="flex flex-col gap-6">
      <Button
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={async () => {
          setFailure(null);
          setIsLoading(true);
          try {
            await authClient.signIn.social({ provider: "google" });
            // En cas de succès la page part vers Google : on ne rend pas la
            // main, sinon le bouton redeviendrait cliquable pendant la
            // navigation.
          } catch (caught) {
            // Le bouton n'avait ni état de chargement ni gestion d'erreur :
            // un clic hors ligne ne produisait strictement rien.
            setFailure(authFailure({ caught }));
            setIsLoading(false);
          }
        }}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continuer avec Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted">
            Ou avec email
          </span>
        </div>
      </div>

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
    </div>
  );
}
