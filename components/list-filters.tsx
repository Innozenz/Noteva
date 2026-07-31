"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Chip = { value: string; label: string };

/**
 * Barre de filtres d'une liste interne (roster, comptes rendus…).
 *
 * Îlot client au sein d'une page serveur : comme `SearchFilters`, il ne détient
 * aucun résultat — il réécrit seulement l'URL, et c'est la page serveur qui
 * filtre. L'état reste ainsi partageable et correct au retour arrière. Les
 * autres paramètres (`onglet`, ancre…) sont préservés, si bien qu'on peut poser
 * ces filtres à l'intérieur d'un onglet de fiche sans en sortir.
 */
export function ListFilters({
  searchKey,
  searchPlaceholder,
  chip,
}: {
  searchKey: string;
  searchPlaceholder: string;
  chip?: { key: string; label: string; options: Chip[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [text, setText] = useState(params.get(searchKey) ?? "");

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

  const activeChip = chip ? params.get(chip.key) : null;
  const hasFilters =
    (params.get(searchKey) ?? "") !== "" || (chip ? activeChip !== null : false);

  const clearAll = () => {
    setText("");
    const next = new URLSearchParams(params.toString());
    next.delete(searchKey);
    if (chip) next.delete(chip.key);
    pushWith(next);
  };

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

      {chip && chip.options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chip.options.map((option) => {
            const active = activeChip === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setParam(chip.key, active ? null : option.value)
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
      ) : hasFilters ? (
        <button
          type="button"
          onClick={clearAll}
          className="flex w-fit items-center gap-1 text-sm text-muted hover:underline"
        >
          <X className="h-3 w-3" />
          Effacer
        </button>
      ) : null}
    </div>
  );
}
