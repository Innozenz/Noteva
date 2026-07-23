import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Music4 } from "lucide-react";

import { ResetPasswordForm } from "@/components/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold"
      >
        <Music4 className="h-5 w-5 text-blue-600" />
        Noteva
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            Choisissez un mot de passe d&apos;au moins 8 caractères.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Le jeton est lu dans l'URL : useSearchParams impose une frontière
              de Suspense pour ne pas rendre toute la page dynamique. */}
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
