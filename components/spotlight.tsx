"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Lumière qui suit le curseur.
 *
 * Seul îlot client de la page d'accueil, et le seul effet qui ne pouvait pas
 * être fait en CSS : rien n'expose la position du pointeur à une feuille de
 * style. Tout le reste du mouvement est dans `globals.css`.
 *
 * Le contenu passe en `children` et reste donc **rendu par le serveur** : c'est
 * ce qui permet d'ajouter de l'interaction à une page publique sans lui retirer
 * ce qui la rend indexable. Ce composant n'affiche aucun texte de lui-même.
 *
 * Deux détails qui font la différence entre fluide et poussif :
 *
 * - **On écrit dans le style, pas dans un état React.** Un `setState` par
 *   `pointermove` rendrait le sous-arbre à chaque pixel parcouru ; ici le
 *   navigateur ne fait que relire deux variables CSS.
 * - **Une mise à jour par image, pas par événement.** Un pointeur émet
 *   largement plus d'événements que l'écran n'affiche d'images, et chacun
 *   déclencherait un `getBoundingClientRect`, donc un recalcul de mise en page.
 *   Mesurer dans l'image plutôt que le mémoriser garde aussi la lumière juste
 *   quand la page défile sous un curseur immobile.
 */
export function Spotlight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const point = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  const cancel = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  useEffect(() => cancel, []);

  return (
    <div
      ref={host}
      className={className}
      onPointerMove={(event) => {
        point.current = { x: event.clientX, y: event.clientY };

        // Une image déjà demandée suffit : les événements suivants ne font que
        // rafraîchir la position qu'elle lira.
        if (frame.current !== null) return;

        frame.current = requestAnimationFrame(() => {
          frame.current = null;

          const element = host.current;
          if (!element) return;

          const rect = element.getBoundingClientRect();

          element.style.setProperty(
            "--spot-x",
            `${point.current.x - rect.left}px`
          );
          element.style.setProperty(
            "--spot-y",
            `${point.current.y - rect.top}px`
          );
          element.style.setProperty("--spot-opacity", "1");
        });
      }}
      onPointerLeave={() => {
        cancel();
        host.current?.style.setProperty("--spot-opacity", "0");
      }}
    >
      {children}
    </div>
  );
}
