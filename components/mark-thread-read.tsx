"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { markThreadRead } from "@/lib/messages/mark-read";

/**
 * Marque le fil d'un couple comme lu à l'ouverture de l'onglet Messages.
 *
 * Rien de visible. Comme pour « Mes cours », le marquage tourne côté client
 * (hors préchargement de lien) puis `router.refresh()` : la pastille de la barre
 * latérale vit dans un layout partagé que Next préserve d'une navigation à
 * l'autre, il faut donc recalculer le layout pour la faire tomber.
 */
export function MarkThreadRead({
  teacherId,
  studentId,
}: {
  teacherId: string;
  studentId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    markThreadRead(teacherId, studentId).then(() => router.refresh());
  }, [teacherId, studentId, router]);

  return null;
}
