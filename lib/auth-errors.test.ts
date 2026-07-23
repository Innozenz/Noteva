import { describe, expect, it } from "vitest";

import { authFailure } from "./auth-errors";

describe("authFailure", () => {
  /**
   * Le cas qui laissait le bouton tourner indéfiniment : `authClient` rejette
   * quand le réseau lâche, et les formulaires de mot de passe n'avaient pas de
   * `catch`.
   */
  it("traite une exception comme une panne réseau", () => {
    const failure = authFailure({ caught: new TypeError("fetch failed") });

    expect(failure.kind).toBe("network");
    expect(failure.canRetry).toBe(true);
  });

  it("traduit les codes connus", () => {
    expect(
      authFailure({ error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD" } })
        .message
    ).toBe("E-mail ou mot de passe incorrect.");

    expect(
      authFailure({
        error: { status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
      }).message
    ).toContain("Un compte existe déjà");
  });

  /**
   * Sur un écran de connexion, un 401 veut dire « mauvais identifiants ». Le
   * message générique enverrait se reconnecter quelqu'un qui est justement en
   * train d'essayer.
   */
  it("ne propose jamais de « se reconnecter » sur un 401", () => {
    const failure = authFailure({
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD" },
    });

    expect(failure.needsSignIn).toBe(false);
    expect(failure.message).not.toContain("session");
  });

  it("gère un 401 dont le code est inconnu", () => {
    const failure = authFailure({ error: { status: 401, code: "MYSTERE" } });

    expect(failure.needsSignIn).toBe(false);
    expect(failure.message).toBe("E-mail ou mot de passe incorrect.");
  });

  /** Le message anglais du fournisseur ne doit jamais atteindre l'écran. */
  it("n'expose jamais le message d'origine", () => {
    const failure = authFailure({
      error: {
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      },
    });

    expect(failure.message).not.toContain("Invalid");
  });

  it("retombe sur le classement par statut pour un code inconnu", () => {
    expect(authFailure({ error: { status: 500, code: "BOOM" } }).kind).toBe(
      "server"
    );
    expect(authFailure({ error: { status: 429, code: "BOOM" } }).kind).toBe(
      "validation"
    );
  });

  it("rend un message même sans erreur exploitable", () => {
    expect(authFailure({ error: null }).message.length).toBeGreaterThan(10);
    expect(authFailure({ error: {} }).message.length).toBeGreaterThan(10);
  });
});
