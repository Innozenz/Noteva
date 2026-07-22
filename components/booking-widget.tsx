"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    setSelected(null);

    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * DAY_MS).toISOString();

    try {
      const response = await fetch(
        `/api/teachers/${teacherSlug}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );

      if (!response.ok) {
        setSlots([]);
        return;
      }

      setSlots((await response.json()).slots);
    } catch {
      setSlots([]);
    }
  }, [teacherSlug, weekStart]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const book = async () => {
    if (!selected) return;

    setIsBooking(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherSlug,
          instrumentSlug: instrument,
          startsAt: selected,
          isTrial,
          studentMessage: message || undefined,
        }),
      });

      if (response.status === 401) {
        setError("Connectez-vous pour réserver un cours.");
        return;
      }

      const body = await response.json();

      if (response.status === 403) {
        // Compte sans profil élève : typiquement un prof, ou un onboarding
        // jamais terminé.
        setError(body?.error ?? "Un compte élève est nécessaire pour réserver.");
        return;
      }

      if (!response.ok) {
        setError(body?.error ?? "Réservation impossible");
        // Le créneau vient probablement d'être pris : on recharge plutôt que
        // de laisser une liste périmée à l'écran.
        if (response.status === 409) loadSlots();
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur");
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
          <CalendarDays className="h-5 w-5 text-blue-600" />
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
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : byDay.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
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
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-zinc-200 hover:border-blue-400 dark:border-zinc-800"
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
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
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
                        ? "border-blue-600 text-blue-700 dark:text-blue-300"
                        : "border-zinc-200 text-zinc-600 dark:border-zinc-800"
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
                  className="h-4 w-4 accent-blue-600"
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

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <Button size="lg" disabled={isBooking} onClick={book}>
              {isBooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Demander ce cours
            </Button>
            <p className="text-center text-xs text-zinc-500">
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
