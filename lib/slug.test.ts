import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./slug";

/** Fabrique un `isTaken` à partir d'un ensemble de slugs déjà pris. */
function taken(...slugs: string[]) {
  const set = new Set(slugs);
  return async (candidate: string) => set.has(candidate);
}

describe("slugify", () => {
  it("met en minuscules et remplace les espaces", () => {
    expect(slugify("Bob Prof")).toBe("bob-prof");
  });

  it("retire les accents des noms français", () => {
    expect(slugify("Élodie Dupré")).toBe("elodie-dupre");
    expect(slugify("Anaïs Gaël Noël")).toBe("anais-gael-noel");
    expect(slugify("François Lefèvre")).toBe("francois-lefevre");
  });

  it("traite apostrophes et traits d'union comme des césures", () => {
    expect(slugify("Jean-Luc D'Aramitz")).toBe("jean-luc-d-aramitz");
  });

  it("ne laisse jamais de césure en tête ou en fin", () => {
    expect(slugify("  ---Marie---  ")).toBe("marie");
    expect(slugify("Marie !!!")).toBe("marie");
  });

  it("écrase les séparateurs répétés", () => {
    expect(slugify("Marie   ///   Curie")).toBe("marie-curie");
  });

  it("conserve les chiffres", () => {
    expect(slugify("Studio 42")).toBe("studio-42");
  });

  it("tronque sans laisser de césure finale", () => {
    const long = slugify("a".repeat(80));
    expect(long).toHaveLength(60);
    expect(long.endsWith("-")).toBe(false);

    // La troncature tombe pile sur une césure : elle doit être retirée.
    const cut = slugify(`${"a".repeat(59)} suite`);
    expect(cut.endsWith("-")).toBe(false);
  });

  it("rend une chaîne vide quand il ne reste rien d'utilisable", () => {
    expect(slugify("🎹🎤")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("rend le slug de base quand il est libre", async () => {
    expect(await uniqueSlug("Bob Prof", taken())).toBe("bob-prof");
  });

  it("numérote à partir de 2 en cas d'homonyme", async () => {
    expect(await uniqueSlug("Bob Prof", taken("bob-prof"))).toBe("bob-prof-2");
    expect(await uniqueSlug("Bob Prof", taken("bob-prof", "bob-prof-2"))).toBe(
      "bob-prof-3"
    );
  });

  it("bascule sur le repli quand le nom ne donne rien", async () => {
    expect(await uniqueSlug("🎹", taken())).toBe("prof");
  });

  it("écarte les segments réservés", async () => {
    expect(await uniqueSlug("Dashboard", taken())).toBe("dashboard-prof");
    expect(await uniqueSlug("api", taken())).toBe("api-prof");
  });

  it("finit par un identifiant aléatoire quand la numérotation sature", async () => {
    const busy = new Set(["bob-prof"]);
    for (let i = 2; i <= 50; i++) busy.add(`bob-prof-${i}`);

    const slug = await uniqueSlug("Bob Prof", async (c) => busy.has(c));

    expect(slug).toMatch(/^bob-prof-[a-z0-9]{6}$/);
  });
});
