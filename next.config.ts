import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pas de distDir configurable : un répertoire de build alternatif n'est
  // ignoré ni par le scanner de Tailwind ni par eslint, qui se mettent alors à
  // lire les artefacts compilés. Pour lancer un second serveur, arrêter le
  // premier.
};

export default nextConfig;
