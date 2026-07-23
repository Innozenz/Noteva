import { describe, expect, it } from "vitest";

import { buildResetPasswordEmail } from "./account";

const CONTEXT = {
  email: "eleve@example.com",
  name: "Louis Bernard",
  url: "https://noteva.fr/api/auth/reset-password/abc123?callbackURL=/reinitialiser-mot-de-passe",
  expiresInMinutes: 60,
};

describe("buildResetPasswordEmail", () => {
  it("part à l'adresse demandée", () => {
    expect(buildResetPasswordEmail(CONTEXT).to).toBe("eleve@example.com");
  });

  it("contient le lien tel quel, jeton compris", () => {
    // Le lien vient de Better Auth : le réécrire casserait le jeton.
    expect(buildResetPasswordEmail(CONTEXT).text).toContain(CONTEXT.url);
  });

  it("s'adresse à la personne par son prénom", () => {
    expect(buildResetPasswordEmail(CONTEXT).text).toContain("Bonjour Louis,");
  });

  it("reste correct sans nom", () => {
    const mail = buildResetPasswordEmail({ ...CONTEXT, name: null });

    expect(mail.text).toContain("Bonjour,");
    expect(mail.text).not.toContain("null");
  });

  it("ignore un nom fait d'espaces", () => {
    expect(buildResetPasswordEmail({ ...CONTEXT, name: "   " }).text).toContain(
      "Bonjour,"
    );
  });

  it("annonce la durée de validité", () => {
    expect(buildResetPasswordEmail(CONTEXT).text).toContain("une heure");
    expect(
      buildResetPasswordEmail({ ...CONTEXT, expiresInMinutes: 30 }).text
    ).toContain("30 minutes");
    expect(
      buildResetPasswordEmail({ ...CONTEXT, expiresInMinutes: 120 }).text
    ).toContain("2 heures");
  });

  it("dit que le lien ne sert qu'une fois", () => {
    expect(buildResetPasswordEmail(CONTEXT).text).toContain("qu'une fois");
  });

  it("rassure celui qui n'a rien demandé", () => {
    // Sans cette phrase, un e-mail non sollicité inquiète pour rien.
    const text = buildResetPasswordEmail(CONTEXT).text;

    expect(text).toContain("ignorez ce message");
    expect(text).toContain("reste valable");
  });

  it("ne divulgue aucun jeton hors du lien", () => {
    const mail = buildResetPasswordEmail(CONTEXT);
    const occurrences = mail.text.split("abc123").length - 1;

    expect(occurrences).toBe(1);
  });
});
