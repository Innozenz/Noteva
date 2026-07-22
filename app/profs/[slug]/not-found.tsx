import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TeacherNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Cette fiche n&apos;est pas disponible</h1>
      <p className="text-zinc-500">
        Le prof que vous cherchez n&apos;existe pas, ou sa fiche n&apos;est plus
        publiée.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
