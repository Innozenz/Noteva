"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Chip = { value: string; label: string };
type ChipGroup = { key: string; label: string; options: Chip[] };

/**
 * Barre de filtres d'une liste interne (roster, comptes rendus…).
 *
 * Îlot client au sein d'une page serveur : comme `SearchFilters`, il ne détient
 * aucun résultat — il réécrit seulement l'URL, et c'est la page serveur qui
 * filtre. L'état reste ainsi partageable et correct au retour arrière. Les
 * autres paramètres (`onglet`, ancre…) sont préservés, si bien qu'on peut poser
 * ces filtres à l'intérieur d'un onglet de fiche sans en sortir.
 *
 * `chips` accepte plusieurs groupes de pastilles (p. ex. élève *et* instrument
 * sur la page comptes rendus). Le libellé du groupe ne s'affiche que lorsqu'il
 * y en a plus d'un — un groupe seul se passe d'étiquette.
 */
export function ListFilters({
  searchKey,
  searchPlaceholder,
  chips,
  dateRange,
}: {
  searchKey: string;
  searchPlaceholder: string;
  chips?: ChipGroup[];
  /** Filtre par plage de dates (civiles, `AAAA-MM-JJ`), bornes incluses. */
  dateRange?: { fromKey: string; toKey: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [text, setText] = useState(params.get(searchKey) ?? "");

  const chipGroups = chips ?? [];
  const managedKeys = [
    searchKey,
    ...chipGroups.map((group) => group.key),
    dateRange?.fromKey,
    dateRange?.toKey,
  ].filter(Boolean) as string[];

  const pushWith = (next: URLSearchParams) => {
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    pushWith(next);
  };

  // Recherche à la frappe, débattue : filtrer une liste déjà chargée gagne à
  // être immédiat, mais réécrire l'URL à chaque touche encombrerait l'historique.
  useEffect(() => {
    const current = params.get(searchKey) ?? "";
    if (text === current) return;
    const timer = setTimeout(() => setParam(searchKey, text || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const hasFilters = managedKeys.some((key) => (params.get(key) ?? "") !== "");

  const clearAll = () => {
    setText("");
    const next = new URLSearchParams(params.toString());
    managedKeys.forEach((key) => next.delete(key));
    pushWith(next);
  };

  const showControls = chipGroups.length > 0 || Boolean(dateRange) || hasFilters;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <Input
          value={text}
          placeholder={searchPlaceholder}
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </div>

      {showControls ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {chipGroups.map((group) => {
            const activeChip = params.get(group.key);
            return (
              <div
                key={group.key}
                className="flex flex-wrap items-center gap-x-2 gap-y-2"
              >
                {chipGroups.length > 1 ? (
                  <span className="text-sm text-subtle">{group.label} :</span>
                ) : null}
                {group.options.map((option) => {
                  const active = activeChip === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setParam(group.key, active ? null : option.value)
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border text-muted hover:border-border-strong"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {dateRange ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Du</span>
              <Input
                type="date"
                aria-label="Date de début"
                value={params.get(dateRange.fromKey) ?? ""}
                max={params.get(dateRange.toKey) || undefined}
                onChange={(event) =>
                  setParam(dateRange.fromKey, event.target.value || null)
                }
                className="h-9 w-auto"
              />
              <span>au</span>
              <Input
                type="date"
                aria-label="Date de fin"
                value={params.get(dateRange.toKey) ?? ""}
                min={params.get(dateRange.fromKey) || undefined}
                onChange={(event) =>
                  setParam(dateRange.toKey, event.target.value || null)
                }
                className="h-9 w-auto"
              />
            </div>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 px-1 text-sm text-muted hover:underline"
            >
              <X className="h-3 w-3" />
              Effacer
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
