import { describe, expect, it } from "vitest";

import { visibilityBlocker } from "@/components/teacher-visibility-notice";
import { hasActiveFilters, parseFilters } from "./query";

/**
 * États vides.
 *
 * Ce qui se teste ici n'est pas de la mise en page mais une distinction de
 * sens : « rien ne correspond à vos filtres » et « il n'y a rien du tout »
 * appellent des réponses opposées, et les confondre revient à reprocher à
 * l'utilisateur une situation dont il n'est pas la cause.
 */

describe("hasActiveFilters", () => {
  it("ne voit aucun filtre sur une recherche nue", () => {
    expect(hasActiveFilters(parseFilters({}))).toBe(false);
  });

  // La page 2 d'une recherche sans filtre reste une recherche sans filtre :
  // sinon on conseillerait d'élargir ce qui n'a jamais été restreint.
  it("ignore la pagination", () => {
    expect(hasActiveFilters(parseFilters({ page: "3" }))).toBe(false);
  });

  it.each([
    ["instrument", { instrument: "chant" }],
    ["ville", { ville: "Lyon" }],
    ["mode", { mode: "online" }],
    ["prix", { prix: "40" }],
    ["essai", { essai: "1" }],
  ])("détecte le filtre %s", (_label, params) => {
    expect(hasActiveFilters(parseFilters(params))).toBe(true);
  });

  it("ignore une valeur vide, qui ne restreint rien", () => {
    expect(hasActiveFilters(parseFilters({ ville: "   " }))).toBe(false);
  });
});

describe("visibilityBlocker", () => {
  const visible = { publishable: true, published: true, subscribed: true };

  it("ne signale rien quand la fiche est visible", () => {
    expect(visibilityBlocker(visible)).toBeNull();
  });

  /**
   * L'ordre est le fond du sujet : il suit le parcours du prof. Réclamer un
   * abonnement à quelqu'un dont la fiche est vide le ferait payer pour une
   * fiche que personne ne pourrait lire.
   */
  it("réclame d'abord la complétude, même sans abonnement", () => {
    expect(
      visibilityBlocker({
        publishable: false,
        published: false,
        subscribed: false,
      })
    ).toBe("incomplete");
  });

  it("réclame ensuite la publication", () => {
    expect(visibilityBlocker({ ...visible, published: false, subscribed: false })).toBe(
      "draft"
    );
  });

  it("ne parle d'abonnement qu'une fois la fiche publiée", () => {
    expect(visibilityBlocker({ ...visible, subscribed: false })).toBe(
      "subscription"
    );
  });

  // Cas réel : une fiche publiée dont l'abonnement expire redevient invisible
  // sans qu'aucun statut ne change en base.
  it("signale un abonnement expiré sur une fiche publiée et complète", () => {
    expect(
      visibilityBlocker({ publishable: true, published: true, subscribed: false })
    ).toBe("subscription");
  });
});
