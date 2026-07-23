import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pas de distDir configurable : un répertoire de build alternatif n'est
  // ignoré ni par le scanner de Tailwind ni par eslint, qui se mettent alors à
  // lire les artefacts compilés. Pour lancer un second serveur, arrêter le
  // premier.

  // En-têtes de sécurité appliqués à toutes les réponses. Pas de
  // Content-Security-Policy ici : une CSP utile exige un nonce par requête
  // (donc le middleware) et une liste des origines réellement utilisées ;
  // une CSP posée à l'aveugle casserait l'hydratation de Next. Les en-têtes
  // ci-dessous, eux, sont sans risque de régression.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Personne n'a de raison d'afficher le site dans une iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le navigateur de deviner un type MIME plus permissif.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // L'URL complète (dont callbackUrl, jetons éventuels) ne sort pas
          // vers les sites tiers.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Aucune page n'utilise caméra, micro ou géolocalisation.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
