"use client";

import { useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { postJson, type Failure } from "@/lib/http/failure";
import { cn } from "@/lib/utils";

type Instrument = { slug: string; name: string };

type PublishCheck = {
  ok: boolean;
  missing: { field: string; message: string }[];
};

export type TeacherProfileData = {
  slug: string;
  status: "DRAFT" | "PENDING" | "PUBLISHED" | "SUSPENDED";
  headline: string | null;
  bio: string | null;
  city: string | null;
  teachesOnline: boolean;
  teachesInPerson: boolean;
  teachesAtHome: boolean;
  hourlyRateCents: number | null;
  trialLessonOffered: boolean;
  trialLessonMinutes: number | null;
  defaultDurationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
  instruments: Instrument[];
  publishCheck: PublishCheck;
  subscriptionActive: boolean;
};

export function TeacherProfileForm({
  initial,
  catalogue,
}: {
  initial: TeacherProfileData;
  catalogue: Instrument[];
}) {
  const [profile, setProfile] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const set = <K extends keyof TeacherProfileData>(
    key: K,
    value: TeacherProfileData[K]
  ) => setProfile((current) => ({ ...current, [key]: value }));

  const toggleInstrument = (instrument: Instrument) => {
    const has = profile.instruments.some((i) => i.slug === instrument.slug);
    set(
 "instruments",
      has
        ? profile.instruments.filter((i) => i.slug !== instrument.slug)
        : [...profile.instruments, instrument]
    );
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await postJson<TeacherProfileData>("/api/teacher/profile", {
        method: "PATCH",
        body: JSON.stringify({
          headline: profile.headline,
          bio: profile.bio,
          city: profile.city,
          teachesOnline: profile.teachesOnline,
          teachesInPerson: profile.teachesInPerson,
          teachesAtHome: profile.teachesAtHome,
          hourlyRateCents: profile.hourlyRateCents,
          trialLessonOffered: profile.trialLessonOffered,
          trialLessonMinutes: profile.trialLessonMinutes,
          defaultDurationMin: profile.defaultDurationMin,
          bufferMin: profile.bufferMin,
          minNoticeHours: profile.minNoticeHours,
          bookingHorizonDays: profile.bookingHorizonDays,
          cancellationWindowHours: profile.cancellationWindowHours,
          instrumentSlugs: profile.instruments.map((i) => i.slug),
        }),
      });

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setProfile(result.data);
      setMessage("Fiche enregistrée");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async () => {
    setIsPublishing(true);
    setError(null);
    setMessage(null);

    try {
      const result = await postJson<{ status: TeacherProfileData["status"] }>(
        "/api/teacher/profile/publish",
        {
          method: "POST",
          body: JSON.stringify({ publish: profile.status !== "PUBLISHED" }),
        }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      set("status", result.data.status);
      setMessage(
        result.data.status === "PUBLISHED" ? "Fiche publiée" : "Fiche dépubliée"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const isPublished = profile.status === "PUBLISHED";
  const canPublish = profile.publishCheck.ok;

  return (
    <div className="flex flex-col gap-6">
      {/* Bandeau d'état */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>Ma fiche</CardTitle>
              <Badge variant={isPublished ? "success" : "secondary"}>
                {isPublished ? "Publiée" : "Brouillon"}
              </Badge>
            </div>
            <Button
              variant={isPublished ? "outline" : "success"}
              disabled={isPublishing || (!isPublished && !canPublish)}
              onClick={togglePublish}
            >
              {isPublishing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isPublished ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {isPublished ? "Dépublier" : "Publier ma fiche"}
            </Button>
          </div>
          <CardDescription>
            Adresse publique : <code>/profs/{profile.slug}</code>
          </CardDescription>
        </CardHeader>

        {!canPublish || !profile.subscriptionActive ? (
          <CardContent className="flex flex-col gap-3">
            {!canPublish ? (
              <div className="rounded-lg bg-warning-soft p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Il reste à compléter
                </p>
                <ul className="space-y-1 text-sm text-muted">
                  {profile.publishCheck.missing.map((item) => (
                    <li key={item.field}>— {item.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!profile.subscriptionActive ? (
              <p className="text-sm text-muted">
                Votre fiche restera invisible des élèves tant que votre
                abonnement n&apos;est pas actif, même une fois publiée.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {/* Présentation */}
      <Card>
        <CardHeader>
          <CardTitle>Présentation</CardTitle>
          <CardDescription>Ce que voit l&apos;élève en premier.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-1">
            <Label htmlFor="headline">Accroche</Label>
            <Input
              id="headline"
              value={profile.headline ?? ""}
              maxLength={120}
              placeholder="Prof de chant diplômée, 10 ans d'expérience"
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bio">Votre approche</Label>
            <Textarea
              id="bio"
              rows={6}
              value={profile.bio ?? ""}
              placeholder="Votre parcours, votre méthode, le public que vous accompagnez…"
              onChange={(e) => set("bio", e.target.value)}
            />
            <p className="text-xs text-muted">
              {(profile.bio ?? "").length} caractères — 80 minimum pour publier.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instruments */}
      <Card>
        <CardHeader>
          <CardTitle>Instruments enseignés</CardTitle>
          <CardDescription>
            Ce sont eux qui décident dans quelles recherches vous apparaissez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {catalogue.map((instrument) => {
              const selected = profile.instruments.some(
                (i) => i.slug === instrument.slug
              );

              return (
                <button
                  key={instrument.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleInstrument(instrument)}
                  className={cn(
 "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-muted hover:border-border-strong"
                  )}
                >
                  {selected ? <Check className="mr-1 inline h-3 w-3" /> : null}
                  {instrument.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modalités et tarif */}
      <Card>
        <CardHeader>
          <CardTitle>Cours et tarif</CardTitle>
          <CardDescription>
            Le règlement se fait directement entre vous et l&apos;élève : Noteva
            n&apos;encaisse rien.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Modalités</legend>
            <Checkbox
              label="En visio"
              checked={profile.teachesOnline}
              onChange={(v) => set("teachesOnline", v)}
            />
            <Checkbox
              label="Chez moi"
              checked={profile.teachesInPerson}
              onChange={(v) => set("teachesInPerson", v)}
            />
            <Checkbox
              label="Chez l'élève"
              checked={profile.teachesAtHome}
              onChange={(v) => set("teachesAtHome", v)}
            />
          </fieldset>

          {profile.teachesInPerson || profile.teachesAtHome ? (
            <div className="space-y-1">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={profile.city ?? ""}
                placeholder="Lyon"
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
          ) : null}

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="rate"
              label="Tarif horaire (€)"
              value={
                profile.hourlyRateCents === null
                  ? ""
                  : String(profile.hourlyRateCents / 100)
              }
              onChange={(v) =>
                set(
 "hourlyRateCents",
                  v === "" ? null : Math.round(Number(v) * 100)
                )
              }
            />
            <NumberField
              id="duration"
              label="Durée d'un cours (min)"
              value={String(profile.defaultDurationMin)}
              onChange={(v) => set("defaultDurationMin", Number(v) || 60)}
            />
          </div>

          <Checkbox
            label="Je propose un cours d'essai"
            checked={profile.trialLessonOffered}
            onChange={(v) => set("trialLessonOffered", v)}
          />
          {profile.trialLessonOffered ? (
            <NumberField
              id="trial"
              label="Durée du cours d'essai (min)"
              value={String(profile.trialLessonMinutes ?? 30)}
              onChange={(v) => set("trialLessonMinutes", Number(v) || 30)}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Règles de réservation */}
      <Card>
        <CardHeader>
          <CardTitle>Règles de réservation</CardTitle>
          <CardDescription>
            Elles filtrent les créneaux proposés aux élèves.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="buffer"
            label="Battement entre deux cours (min)"
            value={String(profile.bufferMin)}
            onChange={(v) => set("bufferMin", Number(v) || 0)}
          />
          <NumberField
            id="notice"
            label="Préavis minimum (h)"
            value={String(profile.minNoticeHours)}
            onChange={(v) => set("minNoticeHours", Number(v) || 0)}
          />
          <NumberField
            id="horizon"
            label="Réservable jusqu'à (jours)"
            value={String(profile.bookingHorizonDays)}
            onChange={(v) => set("bookingHorizonDays", Number(v) || 60)}
          />
          <NumberField
            id="cancel"
            label="Préavis d'annulation (h)"
            value={String(profile.cancellationWindowHours)}
            onChange={(v) => set("cancellationWindowHours", Number(v) || 24)}
          />
        </CardContent>
      </Card>

      <FormFailure failure={error} onRetry={save} />
      {message ? <p className="text-sm text-success">{message}</p> : null}

      {/* Barre d'enregistrement collante. Le bouton flottait seul, sans fond :
          il passait par-dessus la liste d'instruments et masquait les
          dernières lignes. Une barre pleine bordée en haut sépare franchement
          l'action du contenu qu'elle survole. */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-subtle">
            Les modifications ne sont enregistrées qu&apos;ici.
          </span>
          <Button size="lg" disabled={isSaving} onClick={save}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {label}
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
