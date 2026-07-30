import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageTitle } from "@/components/editorial";
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
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-3 border-b border-border pb-8">
        <PageTitle size="page">Mon profil</PageTitle>
        <p className="text-muted">
          Ces informations sont transmises au prof avec vos demandes de cours.
        </p>
      </header>

      <div className="mt-10">
        <StudentProfileForm initial={initial} catalogue={catalogue} />
      </div>
    </div>
  );
}
