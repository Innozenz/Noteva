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
});
