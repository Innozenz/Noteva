# Next.js Boilerplate (Auth + Database + Stripe)

Ce projet est un boilerplate complet pour Next.js incluant l'authentification, une base de données avec Prisma et l'intégration de paiements avec Stripe.

## Stack Technique

- **Framework:** [Next.js 15+](https://nextjs.org)
- **Authentification:** [Better Auth](https://www.better-auth.com/)
- **Base de données:** [Prisma](https://www.prisma.io/) (PostgreSQL par défaut)
- **Paiements:** [Stripe](https://stripe.com/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)

## Configuration

1. **Installation des dépendances :**
   ```bash
   npm install
   ```

2. **Variables d'environnement :**
   Copiez le fichier `.env.example` en `.env` et remplissez les variables nécessaires.
   ```bash
   cp .env.example .env
   ```

3. **Base de données :**
   Générez le client Prisma et poussez le schéma vers votre base de données.
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Authentification Google :**
   Pour utiliser la connexion Google, créez un projet sur [Google Cloud Console](https://console.cloud.google.com/), configurez l'écran de consentement OAuth et créez des identifiants OAuth 2.0. Ajoutez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` à votre fichier `.env`.
   L'URL de redirection sera : `http://localhost:3000/api/auth/callback/google`

5. **Lancement du serveur :**
   ```bash
   npm run dev
   ```

## Structure du projet

- `app/api/auth/[...better-auth]` : Route API pour l'authentification.
- `app/api/stripe/checkout` : Route pour créer des sessions de paiement Stripe.
- `app/api/webhooks/stripe` : Webhook pour gérer les événements Stripe (abonnements).
- `lib/auth.ts` & `lib/auth-client.ts` : Configuration de Better Auth.
- `lib/prisma.ts` : Client Prisma.
- `lib/stripe.ts` & `lib/stripe-client.ts` : Configuration de Stripe.
- `components/` : Composants d'exemple pour l'authentification et Stripe.

## Liens Utiles

- [Documentation Better Auth](https://www.better-auth.com/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation Stripe](https://stripe.com/docs)
