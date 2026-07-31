# 🎨 SiNote — Charte graphique

**« Encre sur papier » — thème « ReChord ».** De l'encre chaude sur un papier ivoire, un primaire épicéa pour ce qui se clique, un bronze rare pour l'emphase. La musique, c'est de l'encre noire sur de la crème — la charte s'y tient.

**La règle qui tient tout : une teinte nomme quelque chose.** Les familles d'instruments nomment une famille, les statuts nomment un état, les gris sont de la mise en page, le bronze est l'emphase éditoriale. Rien ne prend une couleur juste parce que « c'est plus joli » — c'est ce qui rend les couleurs lisibles comme de l'information.

> Thème **clair uniquement**, par choix. Pas de mode sombre, pas de variantes `dark:`.

---

## 🎨 Palette

### Neutres — papier chaud (aucune teinte de marque)

| Aperçu | Token | Hex | Rôle |
| --- | --- | --- | --- |
| ⬜ | `--background` | `#faf8f4` | Fond de page (papier) |
| ◽ | `--surface` | `#f1eee7` | Surface douce (zones, survols) |
| ◽ | `--surface-strong` | `#e7e1d6` | Surface plus marquée (heures fermées de l'agenda) |
| ⬜ | `--elevated` | `#ffffff` | Surfaces élevées (cartes, en-têtes) |
| ⬛ | `--foreground` | `#1f1b16` | Encre (texte principal) |
| 🟫 | `--muted` | `#6e6559` | Texte secondaire |
| 🟤 | `--subtle` | `#a49a8b` | Texte discret, légendes |
| ◽ | `--border` | `#e8e1d5` | Filets, séparateurs |
| ◽ | `--border-strong` | `#d7d0c0` | Filets appuyés |

### Marque

| Aperçu | Token | Hex | Rôle |
| --- | --- | --- | --- |
| 🟢 | `--primary` | `#2d765b` | Épicéa — actions, liens, tout ce qui se clique |
| 🟢 | `--primary-hover` | `#245f49` | Survol du primaire |
| 🟩 | `--primary-soft` | `#dceae4` | Fond doux primaire (sélection, surlignage) |
| ⬜ | `--primary-foreground` | `#fbfbf9` | Texte sur le primaire |
| 🟤 | `--accent` | `#a66f3f` | Bronze — emphase éditoriale, **rare** (soulignés, œils-de-bœuf, pastilles de section) |
| 🟧 | `--accent-soft` | `#f3e7d9` | Fond doux bronze |

### États

| Aperçu | Token | Hex | Rôle |
| --- | --- | --- | --- |
| 🟢 | `--success` | `#059669` | Succès (confirmé, essai, terminé) |
| 🟠 | `--warning` | `#b45309` | Attention (en attente, à compléter) |
| 🔴 | `--danger` | `#dc2626` | Erreur / danger (annulé, non honoré) |

*(Chaque état a aussi une variante `-soft` pour les fonds : `--success-soft`, `--warning-soft`, `--danger-soft`.)*

### Familles d'instruments

Une teinte par famille — c'est le référent des couleurs sur les puces, les notes de la portée, le répertoire. **Espacées sur la roue** (il faut d'abord les distinguer), puis choisies par analogie. La théorie est volontairement neutre : le solfège, c'est la page elle-même.

| Aperçu | Famille | Token | Hex |
| --- | --- | --- | --- |
| 💗 | Voix | `--family-voice` | `#be185d` |
| 🟣 | Claviers | `--family-keyboard` | `#4f46e5` |
| 🟠 | Cordes | `--family-strings` | `#c2410c` |
| 🩵 | Vents | `--family-winds` | `#0f766e` |
| 🟡 | Cuivres | `--family-brass` | `#a16207` |
| 🟢 | Percussions | `--family-percussion` | `#15803d` |
| 🔵 | Électronique | `--family-electronic` | `#0369a1` |
| ⚫ | Théorie | `--family-theory` | `#52525b` |

*(Chaque famille a une variante `-soft` pour les fonds de puces.)*

---

## 🔤 Typographie

- **Corps : Inter** — grotesque neutre, très lisible aux petites tailles.
- **Titres (`h1`–`h3`) : Fraunces** — un serif d'affichage qui donne la voix de la marque.
- Chargées via `next/font` (variables `--font-sans-custom` / `--font-display`).

| Usage | Détail |
| --- | --- |
| Interlettrage du corps | `-0.01em` |
| Interlettrage des titres | `-0.015em` (léger : un serif ne se resserre pas comme une grotesque) |
| Poids des titres | 700 |
| Titre de vitrine (`PageTitle` « display ») | Fraunces, `clamp(2.25rem, 5vw, 3.75rem)` |
| Titre d'écran interne (`PageTitle` « page ») | Fraunces, `text-3xl` / `sm:text-4xl` |

---

## 📐 Mise en page éditoriale

**La règle : des filets et des lignes, pas des cartes.** La carte est réservée à une vraie surface d'action (widget de réservation, item qui porte ses boutons) ; tout le reste — résultats, navigation, sections de formulaire, listes — est une ligne ou une section sur le papier.

Primitives partagées (`components/editorial.tsx`) :

| Primitive | Rôle |
| --- | --- |
| `Eyebrow` | Petit intitulé en capitales espacées, **en bronze**, au-dessus d'un titre |
| `PageTitle` | Titre d'affichage démesuré (Fraunces), tailles `display` / `page` |
| `PageHeader` | Œil-de-bœuf + titre + méta alignée à droite (asymétrie) + filet de clôture |
| `SectionTitle` | Pastille tête-de-note (bronze) + libellé en capitales + filet qui file au bord |
| `RowList` / `Row` | Liste séparée de filets ; le survol lave le fond (`surface`) au lieu d'encadrer |

Largeurs : les pages « texte » se plafonnent (`max-w-4xl`, activité `max-w-5xl`) ; **l'agenda prend toute la largeur** pour que les sept colonnes respirent.

---

## 🔘 Rayons & ombres

| Token | Valeur |
| --- | --- |
| `--radius` | `0.75rem` (12 px) — défaut |
| `--radius-sm` | `0.5rem` (8 px) |
| `--radius-lg` | `1.25rem` (20 px) |

Ombres **discrètes**, teintées de l'encre chaude (`rgb(31 27 22)`, opacité 0.05 → 0.2) : la hiérarchie vient du trait, pas du flou.

---

## 🧩 Composants

- `components/ui/*` : primitives façon shadcn (Radix + `class-variance-authority`), toutes **branchées sur les tokens** (`bg-primary`, jamais `bg-zinc-50`).
- **Boutons** : variantes `default` (primaire), `outline`, `ghost`, plus `success` et `accent`.
- **Badges** : doux-teintés (`secondary`, `success`, `warning`, `accent`) — ils annotent, ils ne rivalisent pas avec les boutons.
- **Modale** : `components/ui/dialog.tsx` (Radix Dialog), overlay + panneau centré.
- Cases à cocher / radios natives teintées via la classe `.accent-primary`.

---

## 🖼️ Identité

- **Favicon** : croche blanche sur une tuile arrondie épicéa (`app/icon.svg`, + `favicon.ico` / `apple-icon.png` générés).
- **Couleurs codées en dur** (hors tokens, à tenir synchronisées à chaque changement de palette) :
  - la favicon (`#2d765b`),
  - les aurores et le spotlight de l'accueil (`app/page.tsx` : `rgb(45 118 91)` primaire, `rgb(166 111 63)` bronze),
  - `app/global-error.tsx` (styles en ligne, car la feuille de style peut ne pas être chargée).

---

## ⚙️ Principes & garde-fous

- **Une teinte nomme quelque chose** — familles = familles, statuts = états, gris = mise en page, bronze = emphase. Les neutres ne portent **aucune** teinte de marque (une erreur passée : des neutres verdis avaient badigeonné toute l'app de vert).
- **Le bronze reste rare** — c'est le seul point chaud d'une palette verte ; le diluer lui ferait perdre son sens.
- **Les huit familles ne bougent pas** — c'est la partie la plus aboutie de la palette.
- **Thème clair uniquement** (`color-scheme: light`) — pas de `dark:`.
- **Pièges Tailwind 4 à éviter** : pas de valeur à virgules dans une classe (dégradés → `style` en ligne), `var()` obligatoire dans une valeur arbitraire, classes de familles écrites **en toutes lettres** (le scanner ne génère pas une classe montée à l'exécution).
