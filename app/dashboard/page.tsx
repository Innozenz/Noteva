"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/user-nav";
import { SubscriptionButton } from "@/components/subscription-button";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Shield,
  Sparkles,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

export default function DashboardPage() {
  const session = authClient.useSession();
  const router = useRouter();

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/user/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!session.data,
  });

  if (session.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-zinc-500">Chargement...</div>
      </div>
    );
  }

  if (!session.data) {
    router.push("/");
    return null;
  }

  const user = session.data.user;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
          </div>
          <UserNav />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <motion.div
          className="grid gap-6 md:grid-cols-2"
          initial="hidden"
          animate="visible"
        >
          {/* Profil */}
          <motion.div custom={0} variants={fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <CardTitle>Profil</CardTitle>
                </div>
                <CardDescription>Vos informations de compte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-500">Nom</p>
                  <p className="font-medium">{user.name || "Non renseigné"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-zinc-500">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-zinc-500">Membre depuis</p>
                  <p className="font-medium">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Abonnement */}
          <motion.div custom={1} variants={fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-600" />
                    <CardTitle>Abonnement</CardTitle>
                  </div>
                  {subscription?.isActive ? (
                    <Badge variant="success">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Inactif</Badge>
                  )}
                </div>
                <CardDescription>
                  Gérez votre abonnement Stripe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ) : subscription?.isActive ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <CalendarDays className="h-4 w-4" />
                      <span>
                        Renouvellement le{" "}
                        {new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-zinc-500">ID abonnement</p>
                      <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {subscription.subscriptionId}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                      <Sparkles className="mt-0.5 h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">Passez à Premium</p>
                        <p className="text-sm text-zinc-500">
                          Débloquez toutes les fonctionnalités et profitez d'une
                          expérience complète.
                        </p>
                      </div>
                    </div>
                    <SubscriptionButton />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions rapides */}
          <motion.div custom={2} variants={fadeIn} className="md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <CardTitle>Actions rapides</CardTitle>
                </div>
                <CardDescription>
                  Gérez votre compte en un clic
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await authClient.signOut();
                      router.push("/");
                      router.refresh();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Se déconnecter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
