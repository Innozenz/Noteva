"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
} from "@/lib/user/photo-constants";

/**
 * Upload de la photo de profil.
 *
 * Indépendant du formulaire de fiche : la photo appartient à `User`, pas à la
 * fiche prof, et s'enregistre seule dès qu'un fichier est choisi (pas de bouton
 * « Enregistrer » partagé). Un `router.refresh()` met aussi à jour l'avatar de
 * l'en-tête, qui lit la même identité côté serveur.
 *
 * Validation côté client d'abord (retour immédiat), mais le serveur revalide et
 * retraite : c'est lui qui fait foi.
 */
export function AvatarUploader({ initialImage }: { initialImage: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(initialImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Réinitialise l'input : re-choisir le même fichier après une erreur doit
    // redéclencher l'événement.
    event.target.value = "";
    if (!file) return;

    if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setError("Format non supporté : envoyez un JPEG, un PNG ou un WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image trop lourde : 5 Mo au maximum.");
      return;
    }

    const body = new FormData();
    body.append("photo", file);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/photo", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { image?: string; error?: string }
        | null;

      if (!res.ok || !data?.image) {
        setError(data?.error ?? "L'envoi a échoué. Réessayez.");
        return;
      }

      setImage(data.image);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/photo", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "La suppression a échoué.");
        return;
      }
      setImage(null);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border border-border">
          <AvatarImage src={image || undefined} alt="Votre photo de profil" />
          <AvatarFallback className="bg-surface">
            <UserRound className="h-8 w-8 text-subtle" />
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={pick}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            {image ? "Changer la photo" : "Ajouter une photo"}
          </Button>

          {image ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirer
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          className="hidden"
          onChange={onFile}
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
