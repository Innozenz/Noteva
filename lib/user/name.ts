/**
 * Nom d'un utilisateur : composition, décomposition, prénom seul.
 *
 * Le modèle porte trois champs et un invariant. `name` est le nom d'affichage
 * au format Better Auth — c'est lui qu'écrit l'inscription et que lit tout le
 * reste de l'application. `firstName` et `lastName` sont la saisie de
 * l'utilisateur, et **toute écriture de ces deux champs recompose `name` dans
 * la même requête**. Il n'y a donc jamais deux vérités sur le nom complet, et
 * aucun site de lecture n'a eu à changer.
 *
 * Pourquoi deux champs plutôt qu'un : la coupure ne se devine pas. « Jean
 * Baptiste Moreau » se découpe aussi bien en Jean / Baptiste Moreau qu'en Jean
 * Baptiste / Moreau, et « Dupont Jean » — saisi nom d'abord, ce que beaucoup de
 * gens font — donne un prénom faux. Or **les avis sont signés du seul prénom** :
 * déduit à la lecture, il était deviné à chaque affichage, sans que l'intéressé
 * puisse le corriger. Une fois saisi, il est exact.
 *
 * Le découpage reste nécessaire pour les comptes qui n'ont jamais rien saisi —
 * Better Auth ne renseigne que `name`. Il vit **ici et nulle part ailleurs** :
 * il en traînait quatre copies, ce qui garantissait qu'elles finiraient par
 * répondre différemment.
 */

export type NameFields = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

/** Réunit prénom et nom. Rend `null` plutôt qu'une chaîne vide ou un espace. */
export function composeName(
  firstName?: string | null,
  lastName?: string | null
): string | null {
  const joined = [firstName, lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

  return joined || null;
}

/**
 * Nom complet affichable.
 *
 * La paire saisie l'emporte sur `name`, qui n'est qu'un cache de cette paire
 * dès qu'elle existe. Sans elle, `name` est la seule vérité.
 */
export function fullName(user: NameFields): string | null {
  return composeName(user.firstName, user.lastName) ?? user.name?.trim() ?? null;
}

/**
 * Prénom seul — ce dont on signe un avis, et ce par quoi on salue quelqu'un.
 *
 * Exact quand il a été saisi ; deviné seulement à défaut.
 */
export function givenName(user: NameFields): string | null {
  const given = user.firstName?.trim();
  if (given) return given;

  return splitFullName(user.name).firstName || null;
}

/**
 * Décompose un nom libre, pour pré-remplir le formulaire d'un compte qui n'a
 * jamais renseigné les deux champs.
 *
 * Le premier mot est le prénom et **tout le reste** le nom : c'est le découpage
 * le moins souvent faux en français, où les noms composés sont plus fréquents
 * que les prénoms composés non tiretés. Ce n'est qu'une amorce — l'intérêt
 * d'avoir deux champs est justement que l'utilisateur la corrige une fois pour
 * toutes.
 */
export function splitFullName(name?: string | null): {
  firstName: string;
  lastName: string;
} {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { firstName: "", lastName: "" };

  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}
