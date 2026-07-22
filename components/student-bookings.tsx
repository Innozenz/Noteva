"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarX,
  Clock,
  Hourglass,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Video,
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
import { groupBookings } from "@/lib/bookings/grouping";

export type StudentBookingRow = {
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
  meetingUrl: string | null;
  address: string | null;
  cancellationReason: string | null;
  instrumentName: string;
  teacherName: string | null;
  teacherSlug: string;
};

type Enriched = Omit<StudentBookingRow, "startsAt" | "endsAt"> & {
  startsAt: Date;
  endsAt: Date;
};

const MODE_LABELS: Record<StudentBookingRow["mode"], string> = {
  ONLINE: "Visio",
  TEACHER_PLACE: "Chez le prof",
  STUDENT_PLACE: "Chez vous",
};

const STATUS_LABELS: Record<StudentBookingRow["status"], string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
  NO_SHOW: "Non honoré",
  DECLINED: "Refusé",
};

export function StudentBookings({
  initial,
  timezone,
}: {
  initial: StudentBookingRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Figé au montage : sans ça, un cours changerait de section pendant que
  // l'élève est sur la page.
  const [now] = useState(() => new Date());

  const groups = useMemo(
    () =>
      groupBookings<Enriched>(
        rows.map((row) => ({
          ...row,
          startsAt: new Date(row.startsAt),
          endsAt: new Date(row.endsAt),
        })),
        now
      ),
    [rows, now]
  );

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "Annulation impossible");
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: body.status } : row
        )
      );

      // Le serveur signale une annulation tardive : le prof avait fixé un
      // préavis. Rien n'est facturé, mais l'élève doit le savoir.
      setNotice(
        body.lateCancellation
          ? "Cours annulé. C'était dans le délai de préavis du prof — pensez à le prévenir directement."
          : "Cours annulé."
      );
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setBusyId(null);
    }
  };

  // L'élève n'a qu'une seule action, et seulement tant que le cours n'a pas eu
  // lieu : confirmer, refuser et clôturer appartiennent au prof.
  const canCancel = (row: Enriched) =>
    (row.status === "PENDING" || row.status === "CONFIRMED") &&
    row.endsAt.getTime() > now.getTime();

  const format = (date: Date) =>
    date.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });

  const renderCard = (row: Enriched) => (
    <div
      key={row.id}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            <Link
              href={`/profs/${row.teacherSlug}`}
              className="hover:underline"
            >
              {row.teacherName ?? "Prof"}
            </Link>
            {" — "}
            {row.instrumentName}
          </p>
          <p className="text-sm text-zinc-500">
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
          <Badge
            variant={row.status === "CONFIRMED" ? "success" : "secondary"}
          >
            {STATUS_LABELS[row.status]}
          </Badge>
        </div>
      </div>

      {/* Le lien de visio n'apparaît qu'une fois le cours confirmé et posé
          par le prof. */}
      {row.status === "CONFIRMED" && row.meetingUrl ? (
        <a
          href={row.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <Video className="h-3 w-3" />
          Rejoindre le cours
        </a>
      ) : null}

      {row.status === "CONFIRMED" && row.address ? (
        <p className="flex items-center gap-1 text-sm text-zinc-500">
          <MapPin className="h-3 w-3" />
          {row.address}
        </p>
      ) : null}

      {row.cancellationReason ? (
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Motif : {row.cancellationReason}
        </p>
      ) : null}

      {canCancel(row) ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={busyId === row.id}
            onClick={() => cancel(row.id)}
          >
            {busyId === row.id ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <CalendarX className="mr-2 h-3 w-3" />
            )}
            Annuler
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-zinc-500">
            Vous n&apos;avez encore réservé aucun cours.
          </p>
          <Button asChild>
            <Link href="/profs">
              <Search className="mr-2 h-4 w-4" />
              Trouver un prof
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-zinc-600">{notice}</p> : null}

      {groups.pending.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hourglass className="h-5 w-5 text-amber-600" />
              <CardTitle>En attente de confirmation</CardTitle>
            </div>
            <CardDescription>
              Le prof doit accepter ces demandes. Vous serez fixé dès sa
              réponse.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groups.pending.map(renderCard)}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-600" />
            <CardTitle>Cours à venir</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {groups.upcoming.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucun cours confirmé à venir.</p>
          ) : (
            groups.upcoming.map(renderCard)
          )}
        </CardContent>
      </Card>

      {groups.toReview.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cours passés</CardTitle>
            <CardDescription>
              En attente de clôture par le prof.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groups.toReview.map(renderCard)}
          </CardContent>
        </Card>
      ) : null}

      {groups.past.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groups.past.slice(0, 20).map(renderCard)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
