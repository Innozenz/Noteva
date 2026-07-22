"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Music, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Role = "TEACHER" | "STUDENT";

const CHOICES: {
  role: Role;
  title: string;
  description: string;
  points: string[];
  icon: typeof Music;
}[] = [
  {
    role: "STUDENT",
    title: "Je veux apprendre",
    description: "Trouvez un prof et réservez vos cours.",
    points: [
      "Recherche par instrument et par niveau",
      "Réservation sur les créneaux libres du prof",
      "Suivi de vos cours à venir",
    ],
    icon: GraduationCap,
  },
  {
    role: "TEACHER",
    title: "Je veux enseigner",
    description: "Publiez votre fiche et gérez votre planning.",
    points: [
      "Agenda et disponibilités récurrentes",
      "Demandes de cours à valider",
      "Fiche publique visible par les élèves",
    ],
    icon: Music,
  },
];

export function OnboardingChoice() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selected,
          // Le fuseau du prof donne son sens à toute sa grille horaire, on le
          // capte donc dès l'inscription plutôt que de supposer Paris.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Une erreur est survenue");
        return;
      }

      const body = await response.json();
      router.push(body.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {CHOICES.map((choice) => {
          const Icon = choice.icon;
          const isSelected = selected === choice.role;

          return (
            <Card
              key={choice.role}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => setSelected(choice.role)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(choice.role);
                }
              }}
              className={cn(
                "cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-600",
                isSelected &&
                  "border-blue-600 ring-2 ring-blue-600/20 dark:border-blue-500"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 text-blue-600" />
                  {isSelected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  ) : null}
                </div>
                <CardTitle>{choice.title}</CardTitle>
                <CardDescription>{choice.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-500">
                  {choice.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden>—</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!selected || isLoading} onClick={submit}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuer
        </Button>
        <p className="text-center text-xs text-zinc-500">
          Ce choix est définitif : une fiche prof porte une adresse publique et
          un historique de cours.
        </p>
      </div>
    </div>
  );
}
