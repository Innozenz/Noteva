import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/editorial";
import { MessageThread } from "@/components/message-thread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Échanges de l'élève avec ses profs.
 *
 * Un fil par prof avec qui l'élève a réservé, chargé à l'ouverture (pas de temps
 * réel). Les commentaires attachés à un compte rendu, eux, restent sur la page
 * « Mes cours », sous le cours concerné.
 */
export default async function StudentMessagesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) redirect("/dashboard");

  const teachers = await prisma.teacherProfile.findMany({
    where: { bookings: { some: { studentId: student.id } } },
    select: {
      id: true,
      user: { select: { name: true, image: true } },
      messages: {
        where: { studentId: student.id, reportId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, sender: true, content: true, createdAt: true },
      },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <PageHeader eyebrow="Espace élève" title="Mes échanges" />

      {teachers.length === 0 ? (
        <p className="mt-10 text-muted">
          Vos échanges avec vos profs apparaîtront ici après votre premier cours.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          {teachers.map((teacher) => {
            const name = teacher.user.name ?? "Professeur";
            return (
              <section
                key={teacher.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={teacher.user.image || undefined} alt={name} />
                    <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="font-medium">{name}</p>
                </div>

                <MessageThread
                  initial={teacher.messages.map((m) => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                  }))}
                  me="STUDENT"
                  postUrl={`/api/student/teachers/${teacher.id}/messages`}
                  emptyLabel="Écrivez un message à votre prof."
                />
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
