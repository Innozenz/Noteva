"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { postJson, type Failure } from "@/lib/http/failure";
import { cn } from "@/lib/utils";

type Slot = { startsAt: string; endsAt: string };
type Instrument = { slug: string; name: string };

const DAY_MS = 86_400_000;

/**
 * Sélection d'un créneau et envoi d'une demande.
 *
 * Îlot client au sein d'une page serveur : les créneaux ne peuvent pas être
 * rendus au build ni mis en cache, ils changent à chaque réservation. Ils sont
 * donc chargés ici, à l'ouverture de la page, pendant que le reste de la fiche
 * reste statique et indexable.
 */
export function BookingWidget({
  teacherSlug,
  instruments,
  timezone,
  trialOffered,
}: {
  teacherSlug: string;
  instruments: Instrument[];
  timezone: string;
  trialOffered: boolean;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [instrument, setInstrument] = useState(instruments[0]?.slug ?? "");
  const [isTrial, setIsTrial] = useState(false);
  const [message, setMessage] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [done, setDone] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    setSelected(null);
    setSlotsFailed(false);

    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * DAY_MS).toISOString();

    const result = await postJson<{ slots: Slot[] }>(
      `/api/teachers/${teacherSlug}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { method: "GET" }
    );

    // Un échec de chargement rendait une liste vide, donc « Aucun créneau
    // disponible cette semaine » — un mensonge qui envoie l'élève chercher
    // ailleurs alors que le prof est peut-être libre toute la semaine.
    if (!result.ok) {
      setSlots([]);
      setSlotsFailed(true);
      return;
    }

    setSlots(result.data.slots);
  }, [teacherSlug, weekStart]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const book = async () => {
    if (!selected) return;

    setIsBooking(true);
    setError(null);

    try {
      const result = await postJson("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          teacherSlug,
          instrumentSlug: instrument,
          startsAt: selected,
          isTrial,
          studentMessage: message || undefined,
        }),
      });

      if (!result.ok) {
        // Cette page est publique : un 401 signifie le plus souvent « pas
        // encore de compte », pas « session expirée ». Le message générique
        // parlerait d'une session que le visiteur n'a jamais ouverte.
        setError(
          result.failure.kind === "auth"
            ? {
                ...result.failure,
                message:
                  "Connectez-vous ou créez un compte pour réserver ce cours. Votre sélection reste à l'écran.",
              }
            : result.failure
        );

        // Un conflit veut dire que le créneau vient d'être pris : on recharge
        // plutôt que de laisser une liste périmée à l'écran.
        if (result.failure.kind === "conflict") loadSlots();
        return;
      }

      setDone(true);
      router.refresh();
    } finally {
      setIsBooking(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Demande envoyée</CardTitle>
          <CardDescription>
            Le prof doit maintenant la confirmer. Vous retrouverez ce cours dans
            votre espace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const byDay = groupByDay(slots ?? [], timezone);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <CardTitle>Réserver un cours</CardTitle>
        </div>
        <CardDescription>
          Horaires affichés dans le fuseau du prof ({timezone}).
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Navigation par semaine */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={weekStart <= startOfWeek(new Date())}
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
          >
            <ChevronLeft className="h-4 w-4" />
            Semaine précédente
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
          >
            Semaine suivante
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {slots === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-subtle" />
          </div>
        ) : slotsFailed ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted">
              Les créneaux n&apos;ont pas pu être chargés. Ce prof est
              peut-être disponible.
            </p>
            <Button variant="outline" size="sm" onClick={loadSlots}>
              Réessayer
            </Button>
          </div>
        ) : byDay.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Aucun créneau disponible cette semaine.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {byDay.map(([day, daySlots]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-medium capitalize">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected === slot.startsAt}
                      onClick={() => setSelected(slot.startsAt)}
                      className={cn(
 "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        selected === slot.startsAt
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary"
                      )}
                    >
                      {formatHour(slot.startsAt, timezone)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {instruments.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {instruments.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setInstrument(item.slug)}
                    className={cn(
 "rounded-full border px-3 py-1 text-sm",
                      instrument === item.slug
                        ? "border-primary text-primary"
                        : "border-border text-muted"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}

            {trialOffered ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isTrial}
                  onChange={(e) => setIsTrial(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Réserver le cours d&apos;essai
              </label>
            ) : null}

            <Textarea
              rows={3}
              value={message}
              placeholder="Un mot sur votre niveau, vos objectifs… (facultatif)"
              onChange={(e) => setMessage(e.target.value)}
            />

            <FormFailure failure={error} onRetry={book} />

            <Button size="lg" disabled={isBooking} onClick={book}>
              {isBooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Demander ce cours
            </Button>
            <p className="text-center text-xs text-muted">
              Rien n&apos;est prélevé : vous réglez le prof directement.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Lundi 00:00 de la semaine courante, heure locale du visiteur. */
function startOfWeek(date: Date): Date {
  const day = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  return monday;
}

function groupByDay(slots: Slot[], timezone: string): [string, Slot[]][] {
  const map = new Map<string, Slot[]>();

  for (const slot of slots) {
    const label = new Date(slot.startsAt).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    });

    map.set(label, [...(map.get(label) ?? []), slot]);
  }

  return [...map.entries()];
}

function formatHour(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}
