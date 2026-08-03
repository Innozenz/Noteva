#!/usr/bin/env node
// @ts-check
/**
 * Régénère `sinote-commits.csv` : l'historique git complet, en colonnes prêtes
 * à importer dans Notion (Type et Domaine deviennent des « select » colorés).
 *
 *   node scripts/generate-commits-csv.mjs      (ou `npm run commits`)
 *
 * Écrit en Node pur, sans awk/bash, pour tourner à l'identique sous Windows,
 * git bash et sur le VPS Linux. Le CSV est un instantané : relancer après un
 * commit pour le rafraîchir.
 *
 * Type ← préfixe conventionnel du message (feat, fix, refonte…).
 * Domaine ← scope entre parenthèses (feat(agenda) → Agenda), avec repli sur
 * quelques mots-clés du sujet quand le scope manque.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "sinote-commits.csv");
const US = "\x1f"; // séparateur de champ improbable dans un message

/** Préfixe de type → libellé avec emoji. */
const TYPE_LABEL = {
  feat: "✨ Fonctionnalité",
  fix: "🐛 Correctif",
  refonte: "🎨 Refonte",
  docs: "📝 Docs",
  chore: "🔧 Config",
  refactor: "♻️ Refactor",
  style: "💄 Style",
  test: "🧪 Tests",
  perf: "⚡ Perf",
  Initial: "🌱 Init", // tout premier commit, hors convention
};
const TYPE_FALLBACK = "🔧 Config";

/** Scope → libellé de domaine (calqué sur les catégories du kanban). */
const DOMAIN_LABEL = {
  AGENDA: "📅 Agenda",
  DESIGN: "🖌️ Design",
  FOND: "🏗️ Fondations",
  PROF: "🧑‍🏫 Espace prof",
  ELEVE: "🎒 Espace élève",
  PUBLIC: "🌍 Public",
  MESSAGERIE: "💬 Messagerie",
  MODER: "🛡️ Modération",
  NOTIF: "🔔 Notifications",
  INFRA: "🛠️ Infra",
};

/** Scope git → code de domaine. */
const SCOPE_TO_DOMAIN = {
  agenda: "AGENDA",
  ui: "DESIGN", charte: "DESIGN", éditorial: "DESIGN", header: "DESIGN", dashboard: "DESIGN",
  ux: "DESIGN", mobile: "DESIGN", "espace connecté": "DESIGN",
  auth: "FOND", db: "FOND", onboarding: "FOND", compte: "FOND",
  créneaux: "FOND", availability: "FOND", réservation: "FOND", reservation: "FOND",
  prof: "PROF", teacher: "PROF", demandes: "PROF", photo: "PROF", stripe: "PROF",
  "comptes-rendus": "PROF", "fiches-eleves": "PROF", fiches: "PROF",
  echanges: "PROF", historique: "PROF",
  student: "ELEVE", "espace-élève": "ELEVE", dossiers: "ELEVE",
  messages: "MESSAGERIE",
  public: "PUBLIC", accueil: "PUBLIC", search: "PUBLIC", recherche: "PUBLIC",
  avis: "MODER",
  notifications: "NOTIF", rappels: "NOTIF",
  api: "INFRA", sécurité: "INFRA", next16: "INFRA", build: "INFRA",
};

/** Repli quand le scope manque : mots-clés du sujet → code de domaine. */
const KEYWORD_TO_DOMAIN = [
  [/stripe|abonnement|paiement/i, "PROF"],
  [/renommage|marque|palette|police|éditorial|design/i, "DESIGN"],
  [/agenda|créneau|semaine/i, "AGENDA"],
  [/rgpd|scaleway|storage|stockage/i, "FOND"],
];

/** Domaine d'un commit, du plus précis (scope) au repli (mots-clés, puis Infra). */
function domainFor(scope, subject) {
  const byScope = SCOPE_TO_DOMAIN[scope];
  if (byScope) return DOMAIN_LABEL[byScope];
  for (const [re, code] of KEYWORD_TO_DOMAIN) {
    if (re.test(subject)) return DOMAIN_LABEL[code];
  }
  return DOMAIN_LABEL.INFRA;
}

/** Échappe un champ CSV : guillemets si nécessaire, guillemets internes doublés. */
function csv(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const log = execFileSync(
  "git",
  ["log", "--reverse", `--pretty=format:%h${US}%ad${US}%s`, "--date=format:%Y-%m-%d %H:%M"],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
);

const rows = [["Titre", "Type", "Domaine", "Date", "Heure", "Commit"]];

for (const line of log.split("\n")) {
  if (!line.trim()) continue;
  const [hash, dateTime, subject] = line.split(US);
  const [date, time] = dateTime.split(" ");

  // type(scope): sujet  —  ou  type: sujet  —  ou message libre
  const conv = subject.match(/^([A-Za-z]+)(?:\(([^)]+)\))?:\s*(.*)$/);
  let type, scope, rest;
  if (conv) {
    [, type, scope = "", rest] = conv;
  } else {
    type = (subject.match(/^[A-Za-z]+/) || ["Autre"])[0];
    scope = "";
    rest = subject;
  }

  // Majuscule initiale (Unicode : « âge » → « Âge »).
  const title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : subject;
  const typeLabel = TYPE_LABEL[type] ?? TYPE_FALLBACK;
  const domain = domainFor(scope, subject);

  rows.push([csv(title), typeLabel, domain, date, time, hash]);
}

writeFileSync(OUT, rows.map((r) => r.join(",")).join("\n") + "\n", "utf8");
console.log(`sinote-commits.csv régénéré — ${rows.length - 1} commits.`);
