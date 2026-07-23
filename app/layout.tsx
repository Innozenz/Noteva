import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

/** Corps de texte : grotesque neutre, très lisible aux petites tailles. */
const sans = Geist({
  variable: "--font-sans-custom",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Titres : c'est là que vit le caractère de la marque. Une seule police
 * d'affichage, réservée aux h1-h3, suffit à donner une voix sans alourdir le
 * chargement.
 */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
    default: "Noteva — cours de musique et de chant près de chez vous",
    // Les pages publiques ne fixent que leur propre titre.
    template: "%s | Noteva",
  },
  description:
    "Trouvez un prof de musique ou de chant, consultez ses disponibilités et réservez votre cours en ligne. Vous réglez le prof directement, sans commission.",
  openGraph: {
    siteName: "Noteva",
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
        className={`${sans.variable} ${display.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
