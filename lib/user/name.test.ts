import { describe, expect, it } from "vitest";

import { composeName, fullName, givenName, splitFullName } from "./name";

describe("composeName", () => {
  it("réunit prénom et nom", () => {
    expect(composeName("Marie", "Dubois")).toBe("Marie Dubois");
  });

  it("supporte un nom absent", () => {
    expect(composeName("Marie", null)).toBe("Marie");
    expect(composeName(null, "Dubois")).toBe("Dubois");
  });

  it("rend null plutôt qu'une chaîne vide ou blanche", () => {
    // Sans quoi l'en-tête afficherait un nom composé d'un espace, et
    // `fullName` ne retomberait jamais sur `name`.
    expect(composeName(null, null)).toBeNull();
    expect(composeName("", "")).toBeNull();
    expect(composeName("   ", "  ")).toBeNull();
  });

  it("nettoie les espaces de saisie", () => {
    expect(composeName("  Marie ", " Dubois  ")).toBe("Marie Dubois");
  });
});

describe("fullName", () => {
  it("préfère la paire saisie", () => {
    expect(
      fullName({ firstName: "Marie", lastName: "Dubois", name: "M. Dubois" })
    ).toBe("Marie Dubois");
  });

  it("retombe sur `name` tant que rien n'a été saisi", () => {
    // Cas de tous les comptes existants : Better Auth ne renseigne que `name`.
    expect(
      fullName({ firstName: null, lastName: null, name: "Marie Dubois" })
    ).toBe("Marie Dubois");
  });

  it("rend null quand il n'y a rien à afficher", () => {
    expect(fullName({ firstName: null, lastName: null, name: null })).toBeNull();
  });
});

describe("givenName", () => {
  it("rend le prénom saisi tel quel", () => {
    expect(givenName({ firstName: "Marie", lastName: "Dubois" })).toBe("Marie");
  });

  it("devine le prénom à défaut de saisie", () => {
    expect(givenName({ name: "Marie Dubois" })).toBe("Marie");
  });

  it("cesse de se tromper dès que le prénom est saisi", () => {
    // « Dupont Jean », saisi nom d'abord : la déduction signait les avis
    // « Dupont ». C'est tout l'intérêt d'avoir un champ à corriger.
    expect(givenName({ name: "Dupont Jean" })).toBe("Dupont");
    expect(
      givenName({ firstName: "Jean", lastName: "Dupont", name: "Dupont Jean" })
    ).toBe("Jean");
  });

  it("rend null quand aucun nom n'est connu", () => {
    expect(givenName({ name: null })).toBeNull();
    expect(givenName({ firstName: "  ", name: "" })).toBeNull();
  });
});

describe("splitFullName", () => {
  it("prend le premier mot pour prénom et tout le reste pour nom", () => {
    expect(splitFullName("Jean Baptiste Moreau")).toEqual({
      firstName: "Jean",
      lastName: "Baptiste Moreau",
    });
  });

  it("accepte un nom d'un seul mot", () => {
    expect(splitFullName("Marie")).toEqual({
      firstName: "Marie",
      lastName: "",
    });
  });

  it("absorbe les espaces multiples", () => {
    expect(splitFullName("  Marie   Dubois  ")).toEqual({
      firstName: "Marie",
      lastName: "Dubois",
    });
  });

  it("ne rend jamais null : le formulaire attend des chaînes", () => {
    expect(splitFullName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitFullName("")).toEqual({ firstName: "", lastName: "" });
  });
});
