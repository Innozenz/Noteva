"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarX,
  Check,
  Clock,
  GraduationCap,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { groupBookings, isUrgent } from "@/lib/bookings/grouping";
import { cn } from "@/lib/utils";

export type BookingRow = {
  id: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED"
    | "COMPLETED"
    | "NO_SHOW"
    | "DECLINED";
  startsAt: string;
  endsAt: string;
  mode: "ONLINE" | "TEACHER_PLACE" | "STUDENT_PLACE";
  isTrial: boolean;
  priceCents: number | null;
  studentMessage: string | null;
  instrumentName: string;
  studentName: string | null;

  // Profil de l'élève, sur l'instrument demandé uniquement.
  studentLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL" | null;
  studentYears: number | null;
  studentOwnsInstrument: boolean | null;
  studentReadsSheetMusic: boolean;
  studentGoals: string | null;
  studentAge: number | null;
  guardianContact: string | null;
  studentIsMinor: boolean;
};

const LEVEL_LABELS: Record<
  NonNullable<BookingRow["studentLevel"]>,
  string
> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  PROFESSIONAL: "Professionnel",
};

type Action = "confirm" | "decline" | "cancel" | "complete" | "no_show";

/** Même ligne, dates converties : le regroupement raisonne sur des instants. */
type Enriched = Omit<BookingRow, "startsAt" | "endsAt"> & {
  startsAt: Date;
  endsAt: Date;
};

const MODE_LABELS: Record<BookingRow["mode"], string> = {
  ONLINE: "Visio",
  TEACHER_PLACE: "Chez vous",
  STUDENT_PLACE: "Chez l'élève",
};

const STATUS_LABELS: Record<BookingRow["status"], string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
  NO_SHOW: "Non honoré",
  DECLINED: "Refusé",
};

export function TeacherBookings({
  initial,
  timezone,
}: {
  initial: BookingRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `now` est figé au montage : recalculer à chaque rendu ferait sauter des
  // cours d'un groupe à l'autre pendant que le prof clique.
  const [now] = useState(() => new Date());

  const groups = useMemo(
    () =>
      groupBookings(
        rows.map((row) => ({
          ...row,
          startsAt: new Date(row.startsAt),
          endsAt: new Date(row.endsAt),
        })),
        now
      ),
    [rows, now]
  );

  const act = async (id: string, action: Action) => {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "Action impossible");
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: body.status } : row
        )
      );
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setBusyId(null);
    }
  };

  // Toujours dans le fuseau du prof : c'est son agenda qu'il consulte, pas
  // celui du navigateur depuis lequel il le consulte.
  const format = (date: Date) =>
    date.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });

  const renderCard = (
    row: Enriched,
    actions: { action: Action; label: string; variant?: string; icon: typeof Check }[]
  ) => {
    const urgent = isUrgent(row, now);

    return (
      <div
        key={row.id}
        className={cn(
 "flex flex-col gap-3 rounded-lg border p-4",
          urgent
            ? "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-border"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">
              {row.studentName ?? "Élève"} — {row.instrumentName}
            </p>
            <p className="text-sm text-muted">
              {format(row.startsAt)} · {MODE_LABELS[row.mode]}
              {row.priceCents !== null
                ? ` · ${(row.priceCents / 100).toFixed(2)} €`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {row.isTrial ? (
              <Badge variant="secondary">
                <Sparkles className="mr-1 h-3 w-3" />
                Essai
              </Badge>
            ) : null}
            {urgent ? (
              <Badge variant="secondary">
                <AlertTriangle className="mr-1 h-3 w-3 text-warning" />
                Bientôt
              </Badge>
            ) : null}
            {row.status !== "PENDING" && row.status !== "CONFIRMED" ? (
              <Badge variant="secondary">{STATUS_LABELS[row.status]}</Badge>
            ) : null}
          </div>
        </div>

        {/* Profil de l'élève : sans lui, une demande arrive nue et le prof
            accepte à l'aveugle. */}
        <StudentSummary row={row} />

        {row.studentMessage ? (
          <p className="flex gap-2 rounded-md bg-surface p-3 text-sm text-muted">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
            {row.studentMessage}
          </p>
        ) : null}

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map(({ action, label, variant, icon: Icon }) => (
              <Button
                key={action}
                size="sm"
                variant={variant as "default"}
                disabled={busyId === row.id}
                onClick={() => act(row.id, action)}
              >
                {busyId === row.id ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-3 w-3" />
                )}
                {label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <CardTitle>Demandes en attente</CardTitle>
            {groups.pending.length > 0 ? (
              <Badge variant="secondary">{groups.pending.length}</Badge>
            ) : null}
          </div>
          <CardDescription>
            Chaque demande bloque son créneau tant que vous n&apos;avez pas
            répondu : personne d&apos;autre ne peut le réserver.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {groups.pending.length === 0 ? (
            <p className="text-sm text-subtle">Aucune demande en attente.</p>
          ) : (
            groups.pending.map((booking) =>
              renderCard(booking, [
                { action: "confirm", label: "Confirmer", icon: Check },
                {
                  action: "decline",
                  label: "Refuser",
                  variant: "outline",
                  icon: X,
                },
              ])
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-success" />
            <CardTitle>Cours à venir</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {groups.upcoming.length === 0 ? (
            <p className="text-sm text-subtle">Aucun cours confirmé à venir.</p>
          ) : (
            groups.upcoming.map((booking) =>
              renderCard(booking, [
                {
                  action: "cancel",
                  label: "Annuler",
                  variant: "outline",
                  icon: CalendarX,
                },
              ])
            )
          )}
        </CardContent>
      </Card>

      {groups.toReview.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>À clôturer</CardTitle>
            <CardDescription>
              Ces cours sont passés. Les marquer comme terminés permettra à
              l&apos;élève de vous laisser un avis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groups.toReview.map((booking) =>
              renderCard(booking, [
                { action: "complete", label: "Cours donné", icon: Check },
                {
                  action: "no_show",
                  label: "Élève absent",
                  variant: "outline",
                  icon: X,
                },
              ])
            )}
          </CardContent>
        </Card>
      ) : null}

      {groups.past.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groups.past.slice(0, 20).map((booking) => renderCard(booking, []))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Résumé de l'élève, tel qu'il aide à décider.
 *
 * Uniquement ce qui sert au choix : niveau sur l'instrument demandé, projet, et
 * contact du responsable si l'élève est mineur. Le reste du profil ne regarde
 * pas le prof.
 */
function StudentSummary({ row }: { row: Enriched }) {
  const facts = [
    row.studentLevel ? LEVEL_LABELS[row.studentLevel] : null,
    row.studentYears !== null
      ? `${row.studentYears} an${row.studentYears > 1 ? "s" : ""} de pratique`
      : null,
    row.studentReadsSheetMusic ? "lit le solfège" : null,
    row.studentOwnsInstrument === false ? "n'a pas l'instrument" : null,
    row.studentAge !== null ? `${row.studentAge} ans` : null,
  ].filter(Boolean) as string[];

  if (facts.length === 0 && !row.studentGoals && !row.studentIsMinor) {
    return (
      <p className="text-sm text-subtle">
        Cet élève n&apos;a pas renseigné son profil.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {facts.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-muted">
          <GraduationCap className="h-4 w-4 shrink-0 text-subtle" />
          {facts.join(" · ")}
        </p>
      ) : null}

      {row.studentGoals ? (
        <p className="text-muted">
          <span className="text-subtle">Objectif : </span>
          {row.studentGoals}
        </p>
      ) : null}

      {row.studentIsMinor ? (
        <p className="flex items-start gap-2 rounded-md bg-blue-50 p-2 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {row.guardianContact
            ? `Élève mineur — responsable : ${row.guardianContact}`
            : "Élève mineur — aucun contact de responsable renseigné."}
        </p>
      ) : null}
    </div>
  );
}
