import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  StudentProfileForm,
  type StudentProfileData,
} from "@/components/student-profile-form";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkStudentProfile } from "@/lib/student/profile";

export default async function StudentProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      birthDate: true,
      guardianName: true,
      guardianEmail: true,
      guardianPhone: true,
      goals: true,
      musicalBackground: true,
      readsSheetMusic: true,
      preferredGenres: true,
      voiceType: true,
      prefersOnline: true,
      city: true,
      instruments: {
        select: {
          level: true,
          yearsPracticed: true,
          ownsInstrument: true,
          instrument: { select: { slug: true, name: true, family: true } },
        },
      },
    },
  });

  if (!profile) redirect("/dashboard");

  const catalogue = await prisma.instrument.findMany({
    select: { slug: true, name: true, family: true },
    orderBy: { name: "asc" },
  });

  const initial: StudentProfileData = {
    ...profile,
    birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
    instruments: profile.instruments.map((entry) => ({
      slug: entry.instrument.slug,
      name: entry.instrument.name,
      family: entry.instrument.family,
      level: entry.level,
      yearsPracticed: entry.yearsPracticed,
      ownsInstrument: entry.ownsInstrument,
    })),
    issues: checkStudentProfile(profile, new Date()),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/dashboard/cours"
        className="mb-6 flex w-fit items-center gap-1 text-sm text-zinc-500 hover:underline"
      >
        <ChevronLeft className="h-3 w-3" />
        Mes cours
      </Link>

      <h1 className="mb-2 text-2xl font-semibold">Mon profil</h1>
      <p className="mb-8 text-zinc-500">
        Ces informations sont transmises au prof avec vos demandes de cours.
      </p>

      <StudentProfileForm initial={initial} catalogue={catalogue} />
    </main>
  );
}
