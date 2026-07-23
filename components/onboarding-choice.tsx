"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Music, Check } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { postJson, type Failure } from "@/lib/http/failure";
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
  const [error, setError] = useState<Failure | null>(null);

  const submit = async () => {
    if (!selected) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await postJson<{ redirectTo?: string }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          role: selected,
          // Le fuseau du prof donne son sens à toute sa grille horaire, on le
          // capte donc dès l'inscription plutôt que de supposer Paris.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      router.push(result.data.redirectTo ?? "/dashboard");
      router.refresh();
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
 "cursor-pointer transition-all hover:border-border-strong",
                isSelected &&
 "border-primary ring-2 ring-primary/20"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 text-primary" />
                  {isSelected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  ) : null}
                </div>
                <CardTitle>{choice.title}</CardTitle>
                <CardDescription>{choice.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted">
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

      <FormFailure failure={error} />

      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!selected || isLoading} onClick={submit}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuer
        </Button>
        <p className="text-center text-xs text-muted">
          Ce choix est définitif : une fiche prof porte une adresse publique et
          un historique de cours.
        </p>
      </div>
    </div>
  );
}
