import type { Metadata } from "next";
import Link from "next/link";
import { Music4 } from "lucide-react";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
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
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Indiquez votre adresse e-mail : nous vous enverrons un lien pour
            choisir un nouveau mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
