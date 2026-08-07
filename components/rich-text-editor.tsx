"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Éditeur de texte riche des comptes rendus (WYSIWYG, côté prof).
 *
 * Une barre d'outils cliquable (gras, italique, barré, titres, listes, citation)
 * au-dessus d'une zone d'édition. Pensé pour des profs non techniques : ils
 * cliquent, ils ne tapent aucune syntaxe. La sortie est du HTML (`getHTML`),
 * remonté au parent à chaque frappe ; il est **assaini côté serveur** avant
 * d'être stocké ou réaffiché (voir `lib/reports/sanitize.ts`).
 *
 * Non contrôlé au sens React : le contenu initial est posé au montage, l'éditeur
 * fait ensuite foi. Le parent le remonte donc à chaque session d'édition (rendu
 * conditionnel), ce qui réinitialise proprement depuis la valeur enregistrée.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Sans intérêt ici, et retirés pour garder une sortie HTML minimale.
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder:
          "Ce qui a été travaillé, les points à revoir, les exercices pour la prochaine fois…",
      }),
    ],
    content: value,
    editable: !disabled,
    // Next rend d'abord côté serveur : sans ceci, l'éditeur se dessine au premier
    // rendu et provoque un décalage d'hydratation.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "rich-text min-h-[8rem] rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1">
      <ToolbarButton
        label="Gras"
        icon={Bold}
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italique"
        icon={Italic}
        active={editor.isActive("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Barré"
        icon={Strikethrough}
        active={editor.isActive("strike")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Titre"
        icon={Heading2}
        active={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Sous-titre"
        icon={Heading3}
        active={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Liste à puces"
        icon={List}
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Liste numérotée"
        icon={ListOrdered}
        active={editor.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Citation"
        icon={Quote}
        active={editor.isActive("blockquote")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Bold;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // `onMouseDown` avec `preventDefault` : garder le focus dans l'éditeur pour
      // que la commande s'applique à la sélection courante.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-40",
        active && "bg-elevated text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}