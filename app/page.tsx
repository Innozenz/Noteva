"use client";

import { motion, type Easing } from "framer-motion";
import { AuthButtons } from "@/components/auth-buttons";
import { SubscriptionButton } from "@/components/subscription-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Database,
  CreditCard,
  Sparkles,
  Zap,
  Lock,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as Easing },
  }),
};

const features = [
  {
    icon: Shield,
    title: "Authentification",
    description: "Email, mot de passe et OAuth Google via Better Auth",
    color: "text-blue-600",
  },
  {
    icon: Database,
    title: "Base de données",
    description: "PostgreSQL avec Prisma ORM, prêt pour la production",
    color: "text-purple-600",
  },
  {
    icon: CreditCard,
    title: "Paiements",
    description: "Stripe Checkout + Webhooks pour les abonnements",
    color: "text-green-600",
  },
  {
    icon: Lock,
    title: "Routes protégées",
    description: "Middleware d'auth avec redirection automatique",
    color: "text-orange-600",
  },
  {
    icon: Zap,
    title: "Stack moderne",
    description: "Next.js 16, React 19, Tailwind CSS 4, TypeScript",
    color: "text-yellow-600",
  },
  {
    icon: Sparkles,
    title: "UI & DX",
    description: "shadcn/ui, Framer Motion, Lucide, TanStack Query, Zustand",
    color: "text-pink-600",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
      {/* Hero */}
      <motion.section
        className="w-full py-20 px-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Badge variant="secondary" className="mb-4">
          Boilerplate SaaS
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Auth + Database + Stripe
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Le point de départ idéal pour votre prochain projet SaaS.
          Tout est configuré, il ne vous reste plus qu&apos;à construire.
        </p>
      </motion.section>

      {/* Features */}
      <motion.section
        className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-12 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="visible"
      >
        {features.map((feature, i) => (
          <motion.div key={feature.title} custom={i} variants={fadeIn}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      {/* Auth + Stripe */}
      <motion.section
        className="mx-auto grid w-full max-w-3xl gap-6 px-4 pb-20 md:grid-cols-2"
        initial="hidden"
        animate="visible"
      >
        <motion.div custom={6} variants={fadeIn}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <CardTitle>Authentification</CardTitle>
              </div>
              <CardDescription>
                Connectez-vous pour accéder au dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthButtons />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={7} variants={fadeIn}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                <CardTitle>Abonnement</CardTitle>
              </div>
              <CardDescription>
                Testez l&apos;intégration Stripe Checkout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SubscriptionButton />
              <p className="text-xs text-zinc-500 italic">
                Configurez votre Stripe Price ID dans les variables d&apos;environnement.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    </div>
  );
}
