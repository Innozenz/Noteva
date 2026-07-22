import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
