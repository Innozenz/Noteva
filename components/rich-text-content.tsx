import { cn } from "@/lib/utils";

/**
 * Rendu en lecture d'un compte rendu.
 *
 * Le `html` reçu est **déjà assaini** (à l'écriture et à chaque frontière
 * serveur, voir `lib/reports/sanitize.ts`) : ce composant ne fait que le poser,
 * sans importer de nettoyeur — il reste ainsi utilisable côté serveur comme
 * client sans embarquer `sanitize-html` dans le bundle.
 *
 * `whitespace-pre-line` préserve les retours à la ligne des anciens comptes
 * rendus en texte brut ; le HTML de TipTap n'ayant pas de saut de ligne entre
 * ses balises, il n'en est pas affecté. La mise en forme (titres, listes, gras)
 * vient de la classe `rich-text` définie dans `globals.css`.
 */
export function RichTextContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rich-text whitespace-pre-line", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}