"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatTime,
  parseTime,
  WEEKDAY_LABELS,
  type GridSlot,
} from "@/lib/teacher/weekly-grid";

type ExceptionRow = {
  id: string;
  date: string;
  type: "BLOCKED" | "EXTRA";
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
};

/** Ligne en cours d'édition : on garde le texte saisi, pas des minutes. */
type DraftRow = { weekday: number; start: string; end: string };

export function AvailabilityEditor({
  timezone,
  initialSlots,
  initialExceptions,
}: {
  timezone: string;
  initialSlots: GridSlot[];
  initialExceptions: ExceptionRow[];
}) {
  const [rows, setRows] = useState<DraftRow[]>(
    initialSlots.map((slot) => ({
      weekday: slot.weekday,
      start: formatTime(slot.startMinute),
      end: formatTime(slot.endMinute),
    }))
  );
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addRow = (weekday: number) =>
    setRows((current) => [...current, { weekday, start: "09:00", end: "12:00" }]);

  const updateRow = (index: number, patch: Partial<DraftRow>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );

  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index));

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const slots: GridSlot[] = [];

    for (const [index, row] of rows.entries()) {
      const startMinute = parseTime(row.start);
      const endMinute = parseTime(row.end);

      if (startMinute === null || endMinute === null) {
        setError(
          `Ligne ${index + 1} : horaire illisible, attendu au format 09:00.`
        );
        setIsSaving(false);
        return;
      }

      if (startMinute >= endMinute) {
        setError(`Ligne ${index + 1} : la fin doit suivre le début.`);
        setIsSaving(false);
        return;
      }

      slots.push({ weekday: row.weekday, startMinute, endMinute });
    }

    try {
      const response = await fetch("/api/teacher/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "Enregistrement impossible");
        return;
      }

      // Le serveur fusionne les plages qui se recouvrent : on réaffiche ce
      // qu'il a réellement retenu, pas ce qui a été tapé.
      setRows(
        body.slots.map((slot: GridSlot) => ({
          weekday: slot.weekday,
          start: formatTime(slot.startMinute),
          end: formatTime(slot.endMinute),
        }))
      );
      setMessage("Disponibilités enregistrées");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Semaine type</CardTitle>
          <CardDescription>
            Vos horaires habituels, exprimés dans votre fuseau ({timezone}).
            Ils se répètent chaque semaine et restent justes au changement
            d&apos;heure.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Une grille vide n'est pas un état neutre : elle ne propose aucun
              créneau, donc la fiche est publiable mais jamais réservable. Sept
              lignes « Indisponible » ne le disaient pas. */}
          {rows.length === 0 ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm">
              Aucune plage définie : aucun créneau n&apos;est proposé aux élèves,
              même une fois votre fiche publiée. Ajoutez au moins une plage.
            </p>
          ) : null}

          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const dayRows = rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.weekday === weekday);

            return (
              <div
                key={weekday}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-start"
              >
                <div className="w-28 pt-2 text-sm font-medium">
                  {WEEKDAY_LABELS[weekday]}
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  {dayRows.length === 0 ? (
                    <p className="py-2 text-sm text-subtle">Indisponible</p>
                  ) : (
                    dayRows.map(({ row, index }) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          aria-label={`Début, ${WEEKDAY_LABELS[weekday]}`}
                          className="w-28"
                          value={row.start}
                          placeholder="09:00"
                          onChange={(e) =>
                            updateRow(index, { start: e.target.value })
                          }
                        />
                        <span className="text-subtle">→</span>
                        <Input
                          aria-label={`Fin, ${WEEKDAY_LABELS[weekday]}`}
                          className="w-28"
                          value={row.end}
                          placeholder="12:00"
                          onChange={(e) =>
                            updateRow(index, { end: e.target.value })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer cette plage"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => addRow(weekday)}
                    className="flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une plage
                  </button>
                </div>
              </div>
            );
          })}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {message ? <p className="text-sm text-success">{message}</p> : null}

          <div className="flex justify-end">
            <Button disabled={isSaving} onClick={save}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Enregistrer la semaine
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExceptionsCard exceptions={exceptions} onChange={setExceptions} />
    </div>
  );
}

function ExceptionsCard({
  exceptions,
  onChange,
}: {
  exceptions: ExceptionRow[];
  onChange: (rows: ExceptionRow[]) => void;
}) {
  const [date, setDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addBlockedDay = async () => {
    if (!date) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/availability/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sans bornes horaires, la journée entière est bloquée.
        body: JSON.stringify({ date, type: "BLOCKED" }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "Ajout impossible");
        return;
      }

      onChange([...exceptions, { ...body, date }]);
      setDate("");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    const response = await fetch(
      `/api/teacher/availability/exceptions?id=${id}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      onChange(exceptions.filter((e) => e.id !== id));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Congés et absences</CardTitle>
        <CardDescription>
          Ces journées sont retirées de votre semaine type. Les cours déjà
          réservés ne sont pas annulés pour autant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="exception-date">Journée à bloquer</Label>
            <Input
              id="exception-date"
              type="date"
              className="w-48"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button variant="outline" disabled={!date || isSaving} onClick={addBlockedDay}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Bloquer
          </Button>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {exceptions.length === 0 ? (
          <p className="text-sm text-subtle">Aucune absence enregistrée.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {exceptions.map((exception) => (
              <li
                key={exception.id}
                className="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm"
              >
                <span>
                  {new Date(`${exception.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
 "fr-FR",
                    { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
                  )}
                  {exception.startMinute === null ? " — journée entière" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Retirer cette absence"
                  onClick={() => remove(exception.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
