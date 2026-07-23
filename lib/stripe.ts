import Stripe from "stripe";

/**
 * Client Stripe côté serveur.
 *
 * La variable s'appelle `STRIPE_SECRET_KEY`, comme dans le Dashboard et comme
 * partout ailleurs dans la configuration. Le boilerplate lisait
 * `STRIPE_API_KEY`, un nom qui n'existait dans aucun `.env` : le module levait
 * alors « Neither apiKey nor config.authenticator provided » à l'évaluation,
 * donc *avant* le `try` des routes, qui renvoyaient une page d'erreur HTML au
 * lieu de leur JSON. Panne invisible tant qu'aucune vraie clé n'avait servi.
 *
 * Le message explicite ci-dessous vaut mieux que celui du SDK : il nomme la
 * variable à renseigner.
 */
const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  throw new Error(
    "STRIPE_SECRET_KEY manquante : impossible d'initialiser le client Stripe."
  );
}

export const stripe = new Stripe(apiKey, {
  typescript: true,
});
