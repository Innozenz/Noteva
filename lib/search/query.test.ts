import { describe, expect, it } from "vitest";

import {
  buildQueryString,
  isDefaultSearch,
  isIndexableSearch,
  normalizeTerm,
  pageOffset,
  parseFilters,
} from "./query";

describe("parseFilters", () => {
  it("rend des filtres vides sur une URL nue", () => {
    expect(parseFilters({})).toEqual({
      instrument: null,
      city: null,
      mode: null,
      maxRateCents: null,
      trialOnly: false,
      page: 1,
    });
  });

  it("lit les filtres présents", () => {
    expect(
      parseFilters({
        instrument: "chant",
        ville: "Lyon",
        mode: "online",
        prix: "45",
        essai: "1",
        page: "3",
      })
    ).toEqual({
      instrument: "chant",
      city: "Lyon",
      mode: "online",
      maxRateCents: 4500,
      trialOnly: true,
      page: 3,
    });
  });

  it("ne retient que la première valeur d'un paramètre répété", () => {
    expect(parseFilters({ instrument: ["chant", "piano"] }).instrument).toBe(
      "chant"
    );
  });

  it("ignore une modalité inconnue", () => {
    expect(parseFilters({ mode: "telepathie" }).mode).toBeNull();
  });

  it("ignore un prix inexploitable", () => {
    for (const prix of ["", "abc", "0", "-10"]) {
      expect(parseFilters({ prix }).maxRateCents).toBeNull();
    }
  });

  it("plafonne le prix", () => {
    expect(parseFilters({ prix: "99999" }).maxRateCents).toBe(100_000);
  });

  it("ramène une page invalide à 1", () => {
    for (const page of ["0", "-2", "abc", "1.5", ""]) {
      expect(parseFilters({ page }).page).toBe(1);
    }
  });

  it("plafonne la pagination profonde", () => {
    expect(parseFilters({ page: "9999" }).page).toBe(100);
  });

  it("ne considère `essai` vrai que sur la valeur exacte", () => {
    expect(parseFilters({ essai: "1" }).trialOnly).toBe(true);
    expect(parseFilters({ essai: "true" }).trialOnly).toBe(false);
    expect(parseFilters({ essai: "0" }).trialOnly).toBe(false);
  });

  it("nettoie et borne les textes", () => {
    expect(parseFilters({ ville: "  Lyon  " }).city).toBe("Lyon");
    expect(parseFilters({ ville: "   " }).city).toBeNull();
    expect(parseFilters({ ville: "x".repeat(200) }).city).toHaveLength(80);
  });
});

describe("buildQueryString", () => {
  it("rend une chaîne vide sans filtre", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("omet la première page", () => {
    expect(buildQueryString({ page: 1 })).toBe("");
    expect(buildQueryString({ page: 2 })).toBe("?page=2");
  });

  it("omet les valeurs par défaut", () => {
    // Une même recherche ne doit avoir qu'une seule adresse.
    expect(buildQueryString({ instrument: "chant", trialOnly: false })).toBe(
      "?instrument=chant"
    );
  });

  it("réexprime le prix en euros", () => {
    expect(buildQueryString({ maxRateCents: 4500 })).toBe("?prix=45");
  });

  it("fait l'aller-retour avec parseFilters", () => {
    const filters = parseFilters({
      instrument: "piano",
      ville: "Lyon",
      mode: "in_person",
      prix: "60",
      essai: "1",
      page: "2",
    });
    const query = buildQueryString(filters);
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));

    expect(parseFilters(params)).toEqual(filters);
  });
});

describe("isDefaultSearch", () => {
  it("reconnaît une recherche sans filtre", () => {
    expect(isDefaultSearch(parseFilters({}))).toBe(true);
    // La pagination seule ne compte pas comme un filtre.
    expect(isDefaultSearch(parseFilters({ page: "4" }))).toBe(true);
  });

  it("reconnaît une recherche filtrée", () => {
    expect(isDefaultSearch(parseFilters({ ville: "Lyon" }))).toBe(false);
    expect(isDefaultSearch(parseFilters({ essai: "1" }))).toBe(false);
  });
});

describe("normalizeTerm", () => {
  it("retire accents et casse", () => {
    expect(normalizeTerm("Guitare Électrique")).toBe("guitare electrique");
    expect(normalizeTerm("  CHANT  ")).toBe("chant");
  });
});

describe("pageOffset", () => {
  it("calcule le décalage", () => {
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(3)).toBe(24);
  });
});

describe("isIndexableSearch", () => {
  it("indexe la page d'accueil de la recherche", () => {
    expect(isIndexableSearch(parseFilters({}))).toBe(true);
  });

  it("indexe les axes à valeur : instrument et ville", () => {
    // « cours de chant à Lyon » est exactement ce qu'un élève tape.
    expect(isIndexableSearch(parseFilters({ instrument: "chant" }))).toBe(true);
    expect(isIndexableSearch(parseFilters({ ville: "Lyon" }))).toBe(true);
    expect(
      isIndexableSearch(parseFilters({ instrument: "chant", ville: "Lyon" }))
    ).toBe(true);
  });

  it("n'indexe pas les filtres combinatoires", () => {
    for (const params of [{ mode: "online" }, { prix: "40" }, { essai: "1" }]) {
      expect(isIndexableSearch(parseFilters(params))).toBe(false);
    }
  });

  it("n'indexe que la première page", () => {
    expect(isIndexableSearch(parseFilters({ page: "2" }))).toBe(false);
  });
});
