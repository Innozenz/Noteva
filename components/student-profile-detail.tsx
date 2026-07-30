import { ShieldAlert } from "lucide-react";

import { SectionTitle } from "@/components/editorial";
import { Badge } from "@/components/ui/badge";

/**
 * Profil élève détaillé, en corps réutilisable (sans en-tête).
 *
 * Partagé par la modale « Voir le profil » des demandes et la fiche élève : une
 * seule mise en forme du profil, pas de dérive entre les deux écrans.
 */

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL";

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

export const LEVEL_LABELS: Record<Level, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  PROFESSIONAL: "Professionnel",
};

export const VOICE_LABELS: Record<string, string> = {
  SOPRANO: "Soprano",
  MEZZO_SOPRANO: "Mezzo-soprano",
  ALTO: "Alto",
  COUNTERTENOR: "Contre-ténor",
  TENOR: "Ténor",
  BARITONE: "Baryton",
  BASS: "Basse",
  UNKNOWN: "Ne sait pas",
};

export function StudentProfileBody({ profile }: { profile: StudentProfileView }) {
  const modeLabel = profile.prefersOnline ? "Préfère la visio" : null;

  return (
    <div className="flex flex-col gap-5">
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
          <span>
            {profile.readsSheetMusic ? "Lit le solfège" : "Ne lit pas le solfège"}
          </span>
          {profile.voiceType ? (
            <span>
              Tessiture : {VOICE_LABELS[profile.voiceType] ?? profile.voiceType}
            </span>
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

      {profile.isMinor ||
      profile.guardian.name ||
      profile.guardian.email ||
      profile.guardian.phone ? (
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
