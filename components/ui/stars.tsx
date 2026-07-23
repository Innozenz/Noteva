import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Affichage d'une note en étoiles.
 *
 * Purement décoratif : la note chiffrée l'accompagne toujours en texte, et
 * c'est elle qui porte l'information. Les étoiles sont donc `aria-hidden`, et
 * un lecteur d'écran entend « 4,5 sur 5 » plutôt que cinq fois « étoile ».
 *
 * Les demi-étoiles sont rendues en superposant une étoile pleine découpée à la
 * largeur voulue : pas de police d'icônes fractionnaire, pas de SVG sur mesure.
 */
export function Stars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimension = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];

  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((position) => {
        // Part de cette étoile qui doit être remplie, de 0 à 1.
        const fill = Math.max(0, Math.min(1, value - position + 1));

        return (
          <span key={position} className="relative inline-block">
            <Star className={cn(dimension, "text-border-strong")} />
            {fill > 0 ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(dimension, "fill-warning text-warning")}
                />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/** Note + étoiles + volume, la forme compacte utilisée dans les listes. */
export function RatingBadge({
  average,
  count,
  size = "sm",
  className,
}: {
  average: number | null;
  count: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // Un prof sans avis n'affiche pas « 0 » : une absence d'avis n'est pas une
  // mauvaise note, et un zéro le laisserait croire.
  if (average === null || count === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <Stars value={average} size={size} />
      <span className="font-medium">
        {average.toFixed(1).replace(".", ",")}
      </span>
      <span className="text-subtle">
        {`(${count} avis)`}
      </span>
    </span>
  );
}
