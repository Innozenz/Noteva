"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Instrument = { slug: string; name: string };

/**
 * Filtres de recherche.
 *
 * Îlot client au sein d'une page serveur : il ne détient aucun résultat, il ne
 * fait que réécrire l'URL. C'est la page serveur qui interroge la base, ce qui
 * garde chaque recherche partageable, indexable, et fonctionnelle au retour
 * arrière du navigateur.
 */
export function SearchFilters({ instruments }: { instruments: Instrument[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const [city, setCity] = useState(params.get("ville") ?? "");

  const current = {
    instrument: params.get("instrument"),
    mode: params.get("mode"),
    essai: params.get("essai") === "1",
  };

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }

    // Tout changement de filtre ramène en page 1 : rester en page 4 d'un
    // résultat qui n'a plus que deux pages afficherait une liste vide.
    next.delete("page");

    const query = next.toString();
    router.push(query ? `/profs?${query}` : "/profs");
  };

  const hasFilters = [...params.keys()].some((key) => key !== "page");

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ ville: city });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="ville">Ville</Label>
          <Input
            id="ville"
            value={city}
            placeholder="Lyon, Paris…"
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          <Search className="mr-2 h-4 w-4" />
          Rechercher
        </Button>
      </form>

      {/* Le catalogue ne contient que les instruments réellement enseignés :
          il est donc vide tant qu'aucun prof n'est visible. Sans cette
          condition, il restait un intitulé « Instrument » suivi de rien. */}
      {instruments.length === 0 ? null : (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Instrument</p>
        <div className="flex flex-wrap gap-2">
          {instruments.map((instrument) => {
            const active = current.instrument === instrument.slug;

            return (
              <button
                key={instrument.slug}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  navigate({ instrument: active ? null : instrument.slug })
                }
                className={cn(
 "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted hover:border-border-strong"
                )}
              >
                {instrument.name}
              </button>
            );
          })}
        </div>
      </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Toggle
          active={current.mode === "online"}
          onClick={() =>
            navigate({ mode: current.mode === "online" ? null : "online" })
          }
        >
          En visio
        </Toggle>
        <Toggle
          active={current.mode === "in_person"}
          onClick={() =>
            navigate({ mode: current.mode === "in_person" ? null : "in_person" })
          }
        >
          En présentiel
        </Toggle>
        <Toggle
          active={current.essai}
          onClick={() => navigate({ essai: current.essai ? null : "1" })}
        >
          Cours d&apos;essai
        </Toggle>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setCity("");
              router.push("/profs");
            }}
            className="flex items-center gap-1 px-2 text-sm text-muted hover:underline"
          >
            <X className="h-3 w-3" />
            Tout effacer
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
 "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border text-muted hover:border-border-strong"
      )}
    >
      {children}
    </button>
  );
}
