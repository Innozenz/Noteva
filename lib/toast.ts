import { create } from "zustand";

import type { Failure } from "@/lib/http/failure";

/**
 * Retours d'action, en toast.
 *
 * Deux règles, pour ne pas doubler le système d'erreurs *inline* déjà en place
 * (`FormFailure`, qui nomme le champ fautif et gère le lien de reconnexion) :
 *
 * - **Succès → toast.** Une confirmation ponctuelle (« Cours confirmé », « Compte
 *   rendu enregistré ») gagne à surgir près de l'action puis à disparaître,
 *   plutôt qu'à s'inscrire dans la page.
 * - **Échec d'une action-bouton → toast**, avec le geste utile : « Se
 *   reconnecter » sur session expirée (nouvel onglet, la saisie reste en place),
 *   « Réessayer » quand un nouvel essai peut aboutir. Les erreurs d'un
 *   *formulaire* (validation par champ) restent, elles, inline.
 *
 * La file vit dans un store Zustand — un état d'UI éphémère, exactement ce à
 * quoi il est réservé ici. `notify*` passe par `getState()`, donc s'appelle
 * depuis n'importe quel gestionnaire d'événement, sans hook. On réutilise la
 * `Failure` de `postJson` : ses distinctions (`needsSignIn`, `canRetry`) portent
 * déjà le bon geste, il ne reste qu'à l'afficher.
 */
export type ToastVariant = "success" | "error";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

type ToastStore = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function notifySuccess(title: string, description?: string) {
  useToastStore.getState().push({ variant: "success", title, description });
}

export function notifyFailure(
  failure: Failure,
  opts?: { onRetry?: () => void }
) {
  const action = failure.needsSignIn
    ? {
        label: "Se reconnecter",
        // Nouvel onglet : rediriger jetterait ce que l'utilisateur a saisi.
        onClick: () => window.open("/connexion", "_blank", "noopener"),
      }
    : failure.canRetry && opts?.onRetry
      ? { label: "Réessayer", onClick: opts.onRetry }
      : undefined;

  useToastStore
    .getState()
    .push({ variant: "error", title: failure.message, action });
}
