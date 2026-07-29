"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERIOD_LABELS, PERIOD_PRESETS } from "@/lib/teacher/activity";
import { cn } from "@/lib/utils";

type Instrument = { slug: string; name: string };

/**
 * Contrôles de la page Activité : période, filtre instrument, export CSV.
 *
 * Îlot client au sein d'une page serveur : il ne détient aucune donnée, il
 * réécrit l'URL. La page serveur relit `searchParams` et recalcule — chaque vue
 * est ainsi une adresse partageable et le bouton retour fonctionne.
 */
export function ActivityControls({ instruments }: { instruments: Instrument[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const periode = params.get("periode") ?? "mois";
  const instrument = params.get("instrument") ?? "";
  const [debut, setDebut] = useState(params.get("debut") ?? "");
  const [fin, setFin] = useState(params.get("fin") ?? "");

  const push = (next: URLSearchParams) => {
    const query = next.toString();
    router.push(query ? `/dashboard/prof/activite?${query}` : "/dashboard/prof/activite");
  };

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    push(next);
  };

  const setPreset = (preset: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("periode", preset);
    // Changer de préset abandonne les bornes personnalisées.
    if (preset !== "perso") {
      next.delete("debut");
      next.delete("fin");
    }
    push(next);
  };

  const isCustom = periode === "perso";
  // Export : même période et même filtre que l'écran, en cours.
  const exportHref = `/api/teacher/activity/export?${params.toString()}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={periode === preset}
            onClick={() => setPreset(preset)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              periode === preset
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted hover:border-border-strong"
            )}
          >
            {PERIOD_LABELS[preset]}
          </button>
        ))}
      </div>

      {isCustom ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (debut && fin) navigate({ periode: "perso", debut, fin });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Du</span>
            <Input
              type="date"
              value={debut}
              max={fin || undefined}
              onChange={(event) => setDebut(event.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Au</span>
            <Input
              type="date"
              value={fin}
              min={debut || undefined}
              onChange={(event) => setFin(event.target.value)}
              className="w-40"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={!debut || !fin}>
            Appliquer
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {instruments.length > 0 ? (
          <select
            aria-label="Filtrer par instrument"
            value={instrument}
            onChange={(event) => navigate({ instrument: event.target.value || null })}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Tous les instruments</option>
            {instruments.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}

        {/* Lien brut (pas un `next/link`) : on veut une vraie requête qui
            télécharge le fichier, pas une navigation client. */}
        <Button variant="outline" size="sm" asChild>
          <a href={exportHref}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
