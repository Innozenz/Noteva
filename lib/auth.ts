import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { buildResetPasswordEmail } from "./notifications/account";
import { sendNotification } from "./notifications/send";
import prisma from "./prisma";

/** Validité du lien de réinitialisation. */
const RESET_TOKEN_MINUTES = 60;

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        /**
         * Envoi du lien de réinitialisation.
         *
         * Attendu, contrairement aux notifications de réservation : ici l'envoi
         * *est* la fonctionnalité. Si l'e-mail ne part pas, l'utilisateur reste
         * bloqué sans le savoir, et il vaut mieux le tracer.
         *
         * L'URL vient de Better Auth et porte déjà le jeton — la réécrire le
         * casserait.
         */
        sendResetPassword: async ({ user, url }) => {
            const result = await sendNotification(
                buildResetPasswordEmail({
                    email: user.email,
                    name: user.name ?? null,
                    url,
                    expiresInMinutes: RESET_TOKEN_MINUTES,
                })
            );

            if (!result.ok) {
                console.error("[RESET_PASSWORD] envoi impossible :", result.error);
            }
        },
        resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
        /**
         * Un mot de passe réinitialisé signifie souvent un compte compromis :
         * les sessions ouvertes ailleurs doivent tomber, sinon un intrus déjà
         * connecté le reste malgré le changement.
         */
        revokeSessionsOnPasswordReset: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    /**
     * Limitation par IP des routes d'authentification. Sans elle, la
     * connexion s'essaie en boucle (force brute) et le reset de mot de passe
     * devient un canon à e-mails vers n'importe quelle adresse.
     *
     * `enabled: true` force la limite aussi en développement : une protection
     * qu'on ne voit jamais fonctionner localement finit par casser en
     * production sans qu'on le remarque. Stockage en mémoire — suffisant tant
     * que l'application tourne sur une seule instance ; passer à un stockage
     * partagé (base ou Redis) le jour où elle est répliquée.
     */
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        customRules: {
            // 5 tentatives de connexion par minute et par IP.
            "/sign-in/email": { window: 60, max: 5 },
            // 3 e-mails de réinitialisation par heure et par IP. Le chemin
            // doit être exactement celui de l'endpoint (comparaison stricte
            // côté Better Auth) : c'est /request-password-reset, pas
            // /forget-password, sinon la règle ne s'applique jamais et la
            // route retombe sur la limite globale (100/min).
            "/request-password-reset": { window: 3600, max: 3 },
            "/reset-password": { window: 3600, max: 5 },
        },
    },
});
