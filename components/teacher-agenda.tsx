"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkTransition, type BookingAction } from "@/lib/bookings/transitions";
import { postJson, type Failure } from "@/lib/http/failure";
import {
  buildWeekAgenda,
  type AgendaDay,
  type PlacedEvent,
} from "@/lib/teacher/agenda";
import { formatTime } from "@/lib/teacher/weekly-grid";
import { cn } from "@/lib/utils";

/**
 * Agenda hebdomadaire du prof.
 *
 * La mise en page vit dans `lib/teacher/agenda.ts`, qui est pure et testée ;
 * ici il n'y a que du rendu et des appels. Et surtout, aucune règle de cycle de
 * vie n'est réimplémentée : les actions proposées sortent de `checkTransition`,
 * la même machine à états que le serveur applique — ce qui interdit à cet écran
 * d'offrir un bouton que PATCH refuserait, ou d'en cacher un qu'il accepterait.
 */

export type AgendaRow = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "NO_SHOW";
  /** Instants ISO : le fuseau d'affichage est celui du prof, pas du navigateur. */
  startsAt: string;
  endsAt: string;
  mode: "ONLINE" | "TEACHER_PLACE" | "STUDENT_PLACE";
  isTrial: boolean;
  priceCents: number | null;
  studentMessage: string | null;
  instrumentName: string;
  studentName: string | null;
};

/** Règle hebdomadaire, bornes de validité en dates civiles AAAA-MM-JJ. */
export type AgendaRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  validFrom: string | null;
  validUntil: string | null;
};

export type AgendaException = {
  date: string;
  type: "BLOCKED" | "EXTRA";
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
};

/** Même ligne, dates converties : la mise en page raisonne sur des instants. */
type AgendaLesson = Omit<AgendaRow, "startsAt" | "endsAt"> & {
  startsAt: Date;
  endsAt: Date;
};

/** Hauteur d'une heure de grille. En dessous, un cours de 30 min est illisible. */
const HOUR_HEIGHT = 56;

/**
 * Lignes horaires : un dégradé répété plutôt qu'un div par heure et par jour.
 * En style inline, car une valeur à virgules dans une classe Tailwind fait
 * inventer au scanner une règle illisible.
 */
const HOUR_LINES = `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`;

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MODE_LABELS: Record<AgendaRow["mode"], string> = {
  ONLINE: "Visio",
  TEACHER_PLACE: "Chez vous",
  STUDENT_PLACE: "Chez l'élève",
};

const STATUS_LABELS: Record<AgendaRow["status"], string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  COMPLETED: "Terminé",
  NO_SHOW: "Non honoré",
};

/**
 * Une demande est bordée en pointillés : rien n'est acquis tant que le prof
 * n'a pas répondu, et le créneau reste immobilisé pendant ce temps.
 */
const STATUS_STYLES: Record<AgendaRow["status"], string> = {
  PENDING: "border-dashed border-warning/60 bg-warning-soft text-warning",
  CONFIRMED: "border-primary/40 bg-primary-soft text-primary",
  COMPLETED: "border-border-strong bg-surface-strong text-muted",
  NO_SHOW: "border-danger/40 bg-danger-soft text-danger",
};

const ACTIONS: {
  action: BookingAction;
  label: string;
  icon: typeof Check;
  variant?: "outline";
}[] = [
  { action: "confirm", label: "Confirmer", icon: Check },
  { action: "decline", label: "Refuser", icon: X, variant: "outline" },
  { action: "complete", label: "Cours donné", icon: Check },
  { action: "no_show", label: "Élève absent", icon: X, variant: "outline" },
  { action: "cancel", label: "Annuler", icon: CalendarX, variant: "outline" },
];

export function TeacherAgenda({
  rows: initial,
  rules,
  exceptions,
  weekStart,
  timezone,
  previousWeek,
  nextWeek,
  currentWeek,
}: {
  rows: AgendaRow[];
  rules: AgendaRule[];
  exceptions: AgendaException[];
  weekStart: string;
  timezone: string;
  previousWeek: string;
  nextWeek: string;
  currentWeek: string;
}) {
  const [rows, setRows] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Figé au montage, comme dans la boîte de réception : recalculer à chaque
  // rendu ferait apparaître et disparaître des boutons pendant que le prof clique.
  const [now] = useState(() => new Date());

  // La semaine affichée vient de l'URL : changer de semaine remonte au serveur,
  // donc les lignes reçues correspondent toujours à `weekStart`.
  useEffect(() => {
    setRows(initial);
    setSelectedId(null);
  }, [initial]);

  const agenda = useMemo(
    () =>
      buildWeekAgenda({
        timezone,
        weekStart,
        rules: rules.map((rule) => ({
          ...rule,
          validFrom: civilDate(rule.validFrom),
          validUntil: civilDate(rule.validUntil),
        })),
        exceptions: exceptions.map((exception) => ({
          ...exception,
          date: civilDate(exception.date)!,
        })),
        events: rows.map(
          (row): AgendaLesson => ({
            ...row,
            startsAt: new Date(row.startsAt),
            endsAt: new Date(row.endsAt),
          })
        ),
        now,
      }),
    [rows, rules, exceptions, weekStart, timezone, now]
  );

  const span = agenda.endMinute - agenda.startMinute;
  const height = (span / 60) * HOUR_HEIGHT;

  /** Position verticale d'une minute locale, en pourcentage de la grille. */
  const offset = (minute: number) =>
    ((minute - agenda.startMinute) / span) * 100;

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const hasOpenings = agenda.days.some((day) => day.open.length > 0);
  const lessons = rows.filter(
    (row) => row.status === "PENDING" || row.status === "CONFIRMED"
  );

  // Durée réelle, pas murale : c'est du temps de travail, pas des lignes de
  // grille. Les deux diffèrent les jours de changement d'heure.
  const totalMinutes = lessons.reduce(
    (sum, row) =>
      sum +
      (new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime()) /
        60_000,
    0
  );

  const act = async (id: string, action: BookingAction) => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result = await postJson<{
        status: AgendaRow["status"] | "CANCELLED" | "DECLINED";
        lateCancellation?: boolean;
      }>(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      const { status } = result.data;

      // Annulé et refusé libèrent le créneau : le cours quitte l'agenda, et la
      // plage réapparaît comme ouverte. Son historique reste dans les demandes.
      if (status === "CANCELLED" || status === "DECLINED") {
        setRows((current) => current.filter((row) => row.id !== id));
        setSelectedId(null);
        setNotice(
          result.data.lateCancellation
            ? "Cours annulé. C'était dans votre délai de prévenance : pensez à prévenir l'élève."
            : "Cours retiré de votre agenda. Le créneau est de nouveau réservable."
        );
        return;
      }

      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, status } : row))
      );
    } finally {
      setBusy(false);
    }
  };

  const select = (id: string) => {
    setSelectedId(id);
    setError(null);
    setNotice(null);
    // Le détail s'ouvre sous une grille haute : sans ça, un clic en haut de
    // semaine ne montre rien à l'écran.
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{weekLabel(agenda.days)}</CardTitle>
              <CardDescription>
                {lessons.length === 0
                  ? "Aucun cours cette semaine."
                  : `${lessons.length} cours · ${formatDuration(totalMinutes)}`}
              </CardDescription>
            </div>

            {/* Navigation en liens : la semaine vit dans l'URL, donc elle se
                partage, se met en favori et répond au bouton retour. */}
            <div className="flex items-center gap-1">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/dashboard/prof/agenda?semaine=${previousWeek}`}
                  aria-label="Semaine précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              {/* Le raccourci ne s'affiche que lorsqu'il mène ailleurs : un
                  bouton grisé occuperait la place sans rien offrir. */}
              {weekStart !== currentWeek ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/prof/agenda">Cette semaine</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/dashboard/prof/agenda?semaine=${nextWeek}`}
                  aria-label="Semaine suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <FormFailure failure={error} />

          {notice ? (
            <p className="flex items-start gap-2 rounded-md bg-primary-soft p-3 text-sm text-primary">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          ) : null}

          {/* Sept colonnes horaires ne tiennent pas sur un téléphone : la
              grille défile horizontalement plutôt que de se comprimer. La
              colonne des heures reste épinglée à gauche — sans elle, un bloc
              vu au milieu du défilement ne dit plus à quelle heure il est. */}
          <div className="-mx-2 overflow-x-auto px-2">
            <div className="min-w-[44rem]">
              <div className="flex">
                <div className="sticky left-0 z-20 w-12 shrink-0 bg-elevated" />
                {agenda.days.map((day) => (
                  <DayHeader key={day.date} day={day} />
                ))}
              </div>

              <div className="flex" style={{ height }}>
                <div className="sticky left-0 z-20 w-12 shrink-0 bg-elevated">
                  {hourMarks(agenda.startMinute, agenda.endMinute).map(
                    (minute) => (
                      <span
                        key={minute}
                        className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-subtle"
                        style={{ top: `${offset(minute)}%` }}
                      >
                        {formatTime(minute)}
                      </span>
                    )
                  )}
                </div>

                <div className="relative flex flex-1 border-t border-border">
                  {agenda.days.map((day) => (
                    <DayColumn
                      key={day.date}
                      day={day}
                      offset={offset}
                      selectedId={selectedId}
                      onSelect={select}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Legend />

          {!hasOpenings ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Aucune plage d&apos;ouverture cette semaine : personne ne peut
                vous réserver de cours.{" "}
                <Link
                  href="/dashboard/prof/disponibilites"
                  className="font-medium underline"
                >
                  Définir mes disponibilités
                </Link>
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div ref={detailRef}>
        {selected ? (
          <BookingDetail
            row={selected}
            timezone={timezone}
            now={now}
            busy={busy}
            onAct={act}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-sm text-subtle">
            Sélectionnez un cours dans la grille pour le confirmer, l&apos;annuler
            ou le clôturer.
          </p>
        )}
      </div>
    </div>
  );
}

function DayHeader({ day }: { day: AgendaDay<AgendaLesson> }) {
  return (
    <div
      className={cn(
        "flex-1 border-l border-border px-1 pb-2 text-center",
        day.isToday && "bg-primary-soft"
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          day.isToday ? "text-primary" : "text-muted"
        )}
      >
        {WEEKDAY_SHORT[day.weekday - 1]}
      </p>
      <p
        className={cn(
          "text-sm tabular-nums",
          day.isToday ? "font-semibold text-primary" : "text-foreground"
        )}
      >
        {Number(day.date.slice(8, 10))}
      </p>
    </div>
  );
}

function DayColumn({
  day,
  offset,
  selectedId,
  onSelect,
}: {
  day: AgendaDay<AgendaLesson>;
  offset: (minute: number) => number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const band = (start: number, end: number) => ({
    top: `${offset(start)}%`,
    height: `${offset(end) - offset(start)}%`,
  });

  return (
    // Gris par défaut : hors des plages ouvertes, personne ne peut réserver.
    // C'est le fond qui porte l'information, la couche blanche des ouvertures
    // se posant par-dessus.
    <div className="relative flex-1 border-l border-border bg-surface-strong">
      {/* Ouvertures : le blanc dit « réservable », sans avoir à l'écrire. */}
      {day.open.map((interval) => (
        <div
          key={`open-${interval.start}`}
          className="absolute inset-x-0 bg-background"
          style={band(interval.start, interval.end)}
        />
      ))}

      {/* Congés : hachures sur le blanc de l'ouverture, pour dire « c'était
          ouvert, je l'ai fermé » — et non « jamais ouvert », qui est le gris. */}
      {day.closed.map((interval) => (
        <div
          key={`closed-${interval.start}`}
          className="absolute inset-x-0 bg-background"
          style={{
            ...band(interval.start, interval.end),
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--border-strong) 0, var(--border-strong) 2px, transparent 2px, transparent 7px)",
          }}
          title="Congé"
        />
      ))}

      {/* Les lignes horaires passent par-dessus les fonds, sinon la bande
          blanche des ouvertures les effacerait là où on en a le plus besoin. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: HOUR_LINES }}
      />

      {day.events.map((placed) => (
        <EventBlock
          key={`${placed.event.id}-${day.date}`}
          placed={placed}
          offset={offset}
          selected={placed.event.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function EventBlock({
  placed,
  offset,
  selected,
  onSelect,
}: {
  placed: PlacedEvent<AgendaLesson>;
  offset: (minute: number) => number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { event, column, columns } = placed;
  const top = offset(placed.startMinute);
  const height = offset(placed.endMinute) - top;

  /**
   * L'heure n'est répétée que si la place le permet. La position verticale du
   * bloc et la gouttière la donnent déjà ; le nom de l'élève, lui, n'est écrit
   * nulle part ailleurs — dans une colonne partagée, « 18:00 … » tronquait la
   * seule information que la grille ne porte pas.
   *
   * Un bloc qui vient de la veille ne l'affiche jamais : sa minute de départ
   * dans ce jour vaut 0, et « 00:00 » serait faux.
   */
  const showTime = columns === 1 && !placed.continuesBefore;

  // Un bloc peut sortir de la grille par le haut ou le bas quand un cours tombe
  // hors des heures affichées ; on le laisse rogné plutôt que d'agrandir la
  // grille, les bornes ayant déjà été calculées pour l'englober.
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      title={`${event.studentName ?? "Élève"} — ${event.instrumentName}`}
      className={cn(
        "absolute overflow-hidden rounded-sm border px-1 py-0.5 text-left text-[11px] leading-tight transition-shadow",
        STATUS_STYLES[event.status],
        placed.continuesBefore && "rounded-t-none border-t-0",
        placed.continuesAfter && "rounded-b-none border-b-0",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(column / columns) * 100}% + 1px)`,
        width: `calc(${100 / columns}% - 2px)`,
      }}
    >
      <span className="block truncate font-medium">
        {showTime ? `${formatTime(placed.startMinute)} ` : ""}
        {event.studentName ?? "Élève"}
      </span>
      <span className="block truncate opacity-80">{event.instrumentName}</span>
    </button>
  );
}

function BookingDetail({
  row,
  timezone,
  now,
  busy,
  onAct,
  onClose,
}: {
  row: AgendaRow;
  timezone: string;
  now: Date;
  busy: boolean;
  onAct: (id: string, action: BookingAction) => void;
  onClose: () => void;
}) {
  const startsAt = new Date(row.startsAt);
  const endsAt = new Date(row.endsAt);

  // Les actions proposées sortent de la machine à états, pas d'une liste
  // recopiée : cet écran ne peut donc pas offrir ce que le serveur refuserait.
  const allowed = ACTIONS.filter(
    (entry) =>
      checkTransition({
        action: entry.action,
        currentStatus: row.status,
        actor: "teacher",
        startsAt,
        endsAt,
        now,
      }).ok
  );

  const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleString("fr-FR", { ...options, timeZone: timezone });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              {row.studentName ?? "Élève"} — {row.instrumentName}
            </CardTitle>
            <CardDescription>
              {format(startsAt, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {format(startsAt, { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {format(endsAt, { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {MODE_LABELS[row.mode]}
              {row.priceCents !== null
                ? ` · ${(row.priceCents / 100).toFixed(2)} €`
                : ""}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {row.isTrial ? (
              <Badge variant="secondary">
                <Sparkles className="mr-1 h-3 w-3" />
                Essai
              </Badge>
            ) : null}
            <Badge variant="secondary">{STATUS_LABELS[row.status]}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Fermer le détail"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {row.studentMessage ? (
          <p className="flex gap-2 rounded-md bg-surface p-3 text-sm text-muted">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
            {row.studentMessage}
          </p>
        ) : null}

        {allowed.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowed.map(({ action, label, icon: Icon, variant }) => (
              <Button
                key={action}
                size="sm"
                variant={variant}
                disabled={busy}
                onClick={() => onAct(row.id, action)}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-3 w-3" />
                )}
                {label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-subtle">
            Ce cours n&apos;attend plus rien de vous.
          </p>
        )}

        <p className="text-xs text-subtle">
          Le profil complet de l&apos;élève est sur{" "}
          <Link href="/dashboard/prof/demandes" className="underline">
            vos demandes
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items = [
    { label: "Confirmé", className: "border-primary/40 bg-primary-soft" },
    {
      label: "En attente",
      className: "border-dashed border-warning/60 bg-warning-soft",
    },
    { label: "Passé", className: "border-border-strong bg-surface-strong" },
    { label: "Ouvert", className: "border-border bg-background" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-xs border", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Heures pleines à graduer, bornes comprises. */
function hourMarks(startMinute: number, endMinute: number): number[] {
  const marks: number[] = [];

  for (let minute = startMinute; minute <= endMinute; minute += 60) {
    marks.push(minute);
  }

  return marks;
}

/**
 * "AAAA-MM-JJ" → Date à minuit UTC, forme sous laquelle Prisma rend une colonne
 * `@db.Date` et sous laquelle le moteur les relit.
 */
function civilDate(key: string | null): Date | null {
  return key ? new Date(`${key}T00:00:00Z`) : null;
}

/**
 * Intitulé de la semaine, à partir des dates civiles.
 *
 * Rendu en UTC, et c'est voulu : une clé AAAA-MM-JJ est déjà exprimée dans le
 * fuseau du prof, la relire dans un fuseau la décalerait une seconde fois.
 */
function weekLabel(days: { date: string }[]): string {
  const first = days[0].date;
  const last = days[days.length - 1].date;

  const render = (key: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString("fr-FR", {
      ...options,
      timeZone: "UTC",
    });

  const sameMonth = first.slice(0, 7) === last.slice(0, 7);

  return `${render(first, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} – ${render(last, { day: "numeric", month: "long", year: "numeric" })}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}
