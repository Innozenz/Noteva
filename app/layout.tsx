import type { Metadata } from "next";
import { Fraunces, Inter, Pinyon_Script } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

/** Corps de texte : Inter, grotesque neutre, très lisible aux petites tailles. */
const sans = Inter({
  variable: "--font-sans-custom",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Titres : c'est là que vit le caractère de la marque. Fraunces, un serif
 * d'affichage variable réservé aux h1-h3, suffit à donner une voix sans
 * alourdir le chargement.
 */
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Signature : Pinyon Script, une anglaise copperplate. Réservée à une seule
 * chose — signer un avis du prénom de l'élève, comme une vraie main. Rationnée
 * comme le bronze : partout ailleurs, ce serait du décor.
 */
const signature = Pinyon_Script({
  variable: "--font-signature-custom",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  // Base absolue : sans elle, les canonical et les images OpenGraph des pages
  // publiques restent relatifs et sont inexploitables par les moteurs et les
  // réseaux sociaux.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "SiNote — cours de musique et de chant près de chez vous",
    // Les pages publiques ne fixent que leur propre titre.
    template: "%s | SiNote",
  },
  description:
    "Trouvez un prof de musique ou de chant, consultez ses disponibilités et réservez votre cours en ligne. Vous réglez le prof directement, sans commission.",
  openGraph: {
    siteName: "SiNote",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${sans.variable} ${display.variable} ${signature.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
