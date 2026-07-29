"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarX,
  Check,
  GraduationCap,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from "lucide-react";

import { SectionTitle } from "@/components/editorial";
import { FormFailure } from "@/components/form-failure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { postJson, type Failure } from "@/lib/http/failure";
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

  // Résumé de carte : niveau sur l'instrument demandé uniquement.
  studentLevel: Level | null;
  studentYears: number | null;
  studentOwnsInstrument: boolean | null;
  studentReadsSheetMusic: boolean;
  studentGoals: string | null;
  studentAge: number | null;
  guardianContact: string | null;
  studentIsMinor: boolean;

  // Profil complet, montré dans la modale « Voir le profil ».
  studentProfile: StudentProfileView;
};

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL";

export type StudentInstrumentView = {
  name: string;
  level: Level;
  yearsPracticed: number | null;
  ownsInstrument: boolean;
};

export type StudentProfileView = {
  age: number | null;
  isMinor: boolean;
  city: string | null;
  goals: string | null;
  background: string | null;
  readsSheetMusic: boolean;
  voiceType: string | null;
  prefersOnline: boolean;
  genres: string[];
  instruments: StudentInstrumentView[];
  guardian: { name: string | null; email: string | null; phone: string | null };
};

const LEVEL_LABELS: Record<Level, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  PROFESSIONAL: "Professionnel",
};

const VOICE_LABELS: Record<string, string> = {
  SOPRANO: "Soprano",
  MEZZO_SOPRANO: "Mezzo-soprano",
  ALTO: "Alto",
  COUNTERTENOR: "Contre-ténor",
  TENOR: "Ténor",
  BARITONE: "Baryton",
  BASS: "Basse",
  UNKNOWN: "Ne sait pas",
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
  const [error, setError] = useState<Failure | null>(null);
  // Demande dont la modale « profil de l'élève » est ouverte.
  const [profileRow, setProfileRow] = useState<Enriched | null>(null);

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
      const result = await postJson<{ status: BookingRow["status"] }>(
        `/api/bookings/${id}`,
        { method: "PATCH", body: JSON.stringify({ action }) }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: result.data.status } : row
        )
      );
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
            ? "border-warning/40 bg-warning-soft"
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

        {/* Résumé ciblé + accès au profil complet en modale. Sans ce résumé,
            une demande arrive nue et le prof accepte à l'aveugle. */}
        <StudentSummary row={row} />

        <button
          type="button"
          onClick={() => setProfileRow(row)}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <User className="h-3.5 w-3.5" />
          Voir le profil de l&apos;élève
        </button>

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
      <FormFailure failure={error} />

      <section className="flex flex-col gap-4">
        <div>
          <SectionTitle
            trailing={
              groups.pending.length > 0 ? (
                <Badge variant="secondary">{groups.pending.length}</Badge>
              ) : null
            }
          >
            Demandes en attente
          </SectionTitle>
          <p className="mt-2 text-sm text-muted">
            Chaque demande bloque son créneau tant que vous n&apos;avez pas
            répondu : personne d&apos;autre ne peut le réserver.
          </p>
        </div>
        <div className="flex flex-col gap-3">
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
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Cours à venir</SectionTitle>
        <div className="flex flex-col gap-3">
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
        </div>
      </section>

      {groups.toReview.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <SectionTitle>À clôturer</SectionTitle>
            <p className="mt-2 text-sm text-muted">
              Ces cours sont passés. Les marquer comme terminés permettra à
              l&apos;élève de vous laisser un avis.
            </p>
          </div>
          <div className="flex flex-col gap-3">
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
          </div>
        </section>
      ) : null}

      {groups.past.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionTitle>Historique</SectionTitle>
          <div className="flex flex-col gap-3">
            {groups.past.slice(0, 20).map((booking) => renderCard(booking, []))}
          </div>
        </section>
      ) : null}

      <Dialog
        open={profileRow !== null}
        onOpenChange={(open) => {
          if (!open) setProfileRow(null);
        }}
      >
        <DialogContent>
          {profileRow ? (
            <StudentProfileDetail
              name={profileRow.studentName}
              instrumentName={profileRow.instrumentName}
              profile={profileRow.studentProfile}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Profil complet de l'élève, en modale, ouvert depuis une demande. On y montre
 * tout ce que l'élève a renseigné ; on n'affiche que les champs remplis, pour
 * ne pas parsemer la fiche de « non renseigné ».
 */
function StudentProfileDetail({
  name,
  instrumentName,
  profile,
}: {
  name: string | null;
  instrumentName: string;
  profile: StudentProfileView;
}) {
  const modeLabel = profile.prefersOnline ? "Préfère la visio" : null;

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{name ?? "Élève"}</DialogTitle>
        <DialogDescription>
          {[
            profile.age !== null ? `${profile.age} ans` : null,
            profile.city,
            `Demande : ${instrumentName}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </DialogDescription>
      </DialogHeader>

      {/* Pratique : tous les instruments, pas seulement celui demandé. */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Ce qu&apos;il pratique</SectionTitle>
        {profile.instruments.length === 0 ? (
          <p className="text-sm text-subtle">Aucun instrument renseigné.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {profile.instruments.map((entry) => (
              <li key={entry.name} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{entry.name}</span>
                <span className="text-muted">
                  {[
                    LEVEL_LABELS[entry.level],
                    entry.yearsPracticed !== null
                      ? `${entry.yearsPracticed} an${entry.yearsPracticed > 1 ? "s" : ""}`
                      : null,
                    entry.ownsInstrument ? "a l'instrument" : "sans instrument",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          <span>{profile.readsSheetMusic ? "Lit le solfège" : "Ne lit pas le solfège"}</span>
          {profile.voiceType ? (
            <span>Tessiture : {VOICE_LABELS[profile.voiceType] ?? profile.voiceType}</span>
          ) : null}
          {modeLabel ? <span>{modeLabel}</span> : null}
        </p>
        {profile.genres.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.genres.map((genre) => (
              <Badge key={genre} variant="secondary">
                {genre}
              </Badge>
            ))}
          </div>
        ) : null}
      </section>

      {profile.goals || profile.background ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Son projet</SectionTitle>
          {profile.goals ? (
            <p className="text-sm text-muted">
              <span className="text-subtle">Objectifs : </span>
              {profile.goals}
            </p>
          ) : null}
          {profile.background ? (
            <p className="text-sm text-muted">
              <span className="text-subtle">Parcours : </span>
              {profile.background}
            </p>
          ) : null}
        </section>
      ) : null}

      {profile.isMinor || profile.guardian.name || profile.guardian.email || profile.guardian.phone ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Responsable légal</SectionTitle>
          {profile.isMinor ? (
            <p className="flex items-start gap-2 rounded-md bg-primary-soft p-2 text-sm text-primary">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Élève mineur — un contact adulte est requis.
            </p>
          ) : null}
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {profile.guardian.name ? <li>{profile.guardian.name}</li> : null}
            {profile.guardian.email ? <li>{profile.guardian.email}</li> : null}
            {profile.guardian.phone ? <li>{profile.guardian.phone}</li> : null}
            {!profile.guardian.name &&
            !profile.guardian.email &&
            !profile.guardian.phone ? (
              <li className="text-subtle">Aucun contact renseigné.</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Résumé de l'élève sur la carte : ce qui aide à décider d'un coup d'œil —
 * niveau sur l'instrument demandé, projet, et contact du responsable si mineur.
 * Le profil **complet** est à un clic, dans la modale « Voir le profil ».
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
        <p className="flex items-start gap-2 rounded-md bg-primary-soft p-2 text-primary">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {row.guardianContact
            ? `Élève mineur — responsable : ${row.guardianContact}`
            : "Élève mineur — aucun contact de responsable renseigné."}
        </p>
      ) : null}
    </div>
  );
}
