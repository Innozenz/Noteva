/**
 * Traduction d'un échec de requête en message utilisable.
 *
 * Fonction pure : elle prend un code et un corps déjà lus, jamais une
 * `Response`. C'est ce qui la rend testable sans réseau, et ce qui permet de
 * pinner des formulations dont dépend l'utilisateur.
 *
 * Le motif qu'elle remplace disait « Impossible de contacter le serveur » dans
 * son `catch`. Or ce `catch` attrapait aussi le `response.json()` d'une réponse
 * **non-JSON** — une page d'erreur 500, un proxy en défaut : le serveur avait
 * répondu, et on affirmait le contraire. Un diagnostic faux envoie l'utilisateur
 * vérifier son wifi pendant que la panne est ailleurs.
 *
 * Trois distinctions portent tout le reste :
 *
 * - **Ce qu'un nouvel essai peut corriger** (réseau, 5xx) et ce qu'il ne
 *   corrigera pas (validation, droit). Proposer « réessayer » sur une erreur de
 *   saisie fait tourner l'utilisateur en rond.
 * - **La session expirée** est le seul cas où l'utilisateur doit partir ailleurs
 *   avant de pouvoir réussir. Elle mérite donc un lien, pas un message.
 * - **Le message du serveur prime quand il en a un.** « Ce créneau vient d'être
 *   réservé » vaut mieux que n'importe quelle formule générique ; l'inverse —
 *   écraser un message précis par un message vague — est une perte sèche.
 */

export type FailureKind =
  | "network"
  | "auth"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "validation"
  | "server";

export type Failure = {
  kind: FailureKind;
  message: string;
  /** Un nouvel essai a une chance d'aboutir sans rien changer. */
  canRetry: boolean;
  /** L'utilisateur doit se reconnecter avant de réessayer. */
  needsSignIn: boolean;
};

/**
 * Message du serveur, s'il en a fourni un d'exploitable.
 *
 * Un corps non-JSON rend `null` : une page HTML d'erreur affichée telle quelle
 * dans un formulaire serait pire que rien.
 */
function serverMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;

  const error = (body as { error?: unknown }).error;

  return typeof error === "string" && error.trim() ? error.trim() : null;
}

/**
 * Erreur détectée avant tout envoi — une saisie que le formulaire refuse
 * lui-même. Même forme que les échecs réseau pour n'avoir qu'un seul chemin
 * d'affichage : ni « réessayer », ni reconnexion, puisque seul l'utilisateur
 * peut la corriger.
 */
export function localFailure(message: string): Failure {
  return { kind: "validation", message, canRetry: false, needsSignIn: false };
}

export function describeFailure(input: {
  /** `null` quand aucune réponse n'est parvenue. */
  status: number | null;
  body?: unknown;
}): Failure {
  const { status } = input;
  const fromServer = serverMessage(input.body);

  if (status === null) {
    return {
      kind: "network",
      message:
        "Connexion perdue. Vérifiez votre réseau, puis réessayez — rien n'a été envoyé.",
      canRetry: true,
      needsSignIn: false,
    };
  }

  if (status === 401) {
    return {
      kind: "auth",
      // On ne dit pas « non authentifié », qui est le vocabulaire du serveur et
      // n'indique aucun geste. Et on précise que la saisie est conservée : c'est
      // la première inquiétude de quelqu'un qui vient de remplir un formulaire.
      message:
        "Votre session a expiré. Reconnectez-vous dans un autre onglet, puis réessayez : ce que vous avez saisi est toujours là.",
      canRetry: false,
      needsSignIn: true,
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      message: fromServer ?? "Vous n'avez pas accès à cette action.",
      canRetry: false,
      needsSignIn: false,
    };
  }

  if (status === 404) {
    return {
      kind: "notFound",
      message: fromServer ?? "Cet élément n'existe plus.",
      canRetry: false,
      needsSignIn: false,
    };
  }

  // 409 : le serveur a une raison précise — créneau pris, avis déjà déposé,
  // abonnement déjà actif. La reprendre telle quelle est tout l'intérêt.
  if (status === 409) {
    return {
      kind: "conflict",
      message: fromServer ?? "Cette action n'est plus possible.",
      canRetry: false,
      needsSignIn: false,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      kind: "validation",
      message: fromServer ?? "Certaines informations sont invalides.",
      canRetry: false,
      needsSignIn: false,
    };
  }

  return {
    kind: "server",
    // Pas de message du serveur ici, même s'il en donne un : un 500 porte
    // souvent une trace interne, qui n'aide pas l'utilisateur et renseigne un
    // attaquant.
    message: "Le serveur a rencontré un problème. Réessayez dans un instant.",
    canRetry: true,
    needsSignIn: false,
  };
}

/**
 * Enveloppe de `fetch` qui ne ment jamais sur la cause.
 *
 * Sépare les deux échecs que le motif précédent confondait : la requête n'est
 * pas partie (réseau), ou elle est partie et la réponse n'était pas du JSON
 * exploitable (serveur).
 */
export async function postJson<T>(
  url: string,
  init: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; failure: Failure }> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    return { ok: false, failure: describeFailure({ status: null }) };
  }

  const text = await response.text();
  let body: unknown = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      failure: describeFailure({ status: response.status, body }),
    };
  }

  return { ok: true, data: body as T };
}
