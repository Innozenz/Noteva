import type { Notification } from "./templates";

/**
 * Messages liés au compte, distincts des notifications de réservation.
 *
 * Même principe : contenu en fonction pure, testable sans fournisseur.
 */

export type ResetPasswordContext = {
  email: string;
  name: string | null;
  /** Lien fabriqué par Better Auth, déjà porteur du jeton. */
  url: string;
  /** Durée de validité, pour la dire à l'utilisateur. */
  expiresInMinutes: number;
};

export function buildResetPasswordEmail(
  context: ResetPasswordContext
): Notification {
  const greeting = context.name?.trim()
    ? `Bonjour ${context.name.trim().split(" ")[0]},`
    : "Bonjour,";

  return {
    to: context.email,
    subject: "Réinitialiser votre mot de passe Noteva",
    text: [
      greeting,
      ``,
      `Vous avez demandé à réinitialiser votre mot de passe. Ouvrez ce lien pour en choisir un nouveau :`,
      context.url,
      ``,
      `Ce lien est valable ${formatDuration(context.expiresInMinutes)} et ne fonctionne qu'une fois.`,
      ``,
      // Un e-mail non sollicité n'appelle aucune action : le dire évite une
      // inquiétude inutile, et rappelle qu'aucun mot de passe n'a changé.
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.`,
    ].join("\n"),
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;

  const hours = Math.round(minutes / 60);

  return hours === 1 ? "une heure" : `${hours} heures`;
}
