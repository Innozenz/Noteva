import { describe, expect, it } from "vitest";

import { describeFailure, postJson } from "./failure";

describe("describeFailure", () => {
  it("distingue l'absence de réponse d'une réponse en erreur", () => {
    const offline = describeFailure({ status: null });

    expect(offline.kind).toBe("network");
    expect(offline.canRetry).toBe(true);
    // Rassurer sur ce qui n'a pas été envoyé évite le double envoi manuel.
    expect(offline.message).toContain("rien n'a été envoyé");
  });

  /**
   * Le cas qui justifie toute cette fonction : une réponse 500 non-JSON
   * faisait échouer `response.json()`, le `catch` du formulaire s'activait, et
   * l'utilisateur lisait « Impossible de contacter le serveur » alors que le
   * serveur avait parfaitement répondu.
   */
  it("ne prend pas une erreur serveur pour une panne de réseau", () => {
    const failure = describeFailure({ status: 500, body: null });

    expect(failure.kind).toBe("server");
    expect(failure.message).not.toContain("réseau");
    expect(failure.canRetry).toBe(true);
  });

  it("demande une reconnexion sur 401, sans proposer de réessayer", () => {
    const failure = describeFailure({ status: 401, body: { error: "Non authentifié" } });

    expect(failure.needsSignIn).toBe(true);
    expect(failure.canRetry).toBe(false);
    // Le vocabulaire du serveur n'indique aucun geste à l'utilisateur.
    expect(failure.message).not.toContain("Non authentifié");
    // La saisie est la première inquiétude de qui vient de remplir un formulaire.
    expect(failure.message).toContain("toujours là");
  });

  it("reprend le message du serveur quand il est précis", () => {
    const failure = describeFailure({
      status: 409,
      body: { error: "Ce créneau vient d'être réservé" },
    });

    expect(failure.kind).toBe("conflict");
    expect(failure.message).toBe("Ce créneau vient d'être réservé");
    // Un conflit ne se résout pas en réessayant à l'identique.
    expect(failure.canRetry).toBe(false);
  });

  /**
   * Un 500 porte souvent une trace interne. La reprendre n'aide pas
   * l'utilisateur et renseigne un attaquant sur la pile technique.
   */
  it("n'expose jamais le message d'un 500", () => {
    const failure = describeFailure({
      status: 500,
      body: { error: "PrismaClientKnownRequestError: connect ECONNREFUSED 10.0.0.4:5432" },
    });

    expect(failure.message).not.toContain("Prisma");
    expect(failure.message).not.toContain("ECONNREFUSED");
  });

  it("ignore un corps qui n'est pas du JSON exploitable", () => {
    for (const body of ["<!DOCTYPE html>", null, undefined, 42, [], { error: "" }, { error: 7 }]) {
      const failure = describeFailure({ status: 400, body });

      expect(failure.message).toBe("Certaines informations sont invalides.");
    }
  });

  it("ne propose de réessayer que là où c'est utile", () => {
    const retryable = [null, 500, 502, 503];
    const not = [400, 401, 403, 404, 409, 422];

    for (const status of retryable) {
      expect(describeFailure({ status }).canRetry).toBe(true);
    }
    for (const status of not) {
      expect(describeFailure({ status }).canRetry).toBe(false);
    }
  });

  it.each([
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
    [422, "validation"],
    [503, "server"],
  ])("classe %i en %s", (status, kind) => {
    expect(describeFailure({ status }).kind).toBe(kind);
  });

  it("rend un message non vide dans tous les cas", () => {
    for (const status of [null, 400, 401, 403, 404, 409, 418, 500, 599]) {
      expect(describeFailure({ status }).message.length).toBeGreaterThan(10);
    }
  });
});

/**
 * `postJson` lui-même, contre un vrai `fetch`.
 *
 * `describeFailure` est pure et se teste sans réseau ; l'enveloppe, elle, doit
 * être vérifiée là où elle sert : c'est son `catch` qui distinguait mal la
 * requête jamais partie de la réponse illisible.
 */
describe("postJson", () => {
  it("rend un échec réseau quand le serveur ne répond pas", async () => {
    // Port fermé : la connexion échoue avant toute réponse.
    const result = await postJson("http://127.0.0.1:9/rien", { method: "POST" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("network");
    expect(result.failure.canRetry).toBe(true);
  });

  it("ne confond pas une URL invalide avec autre chose qu'un échec réseau", async () => {
    const result = await postJson("http://[invalide", { method: "POST" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("network");
  });
});
