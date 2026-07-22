import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { checkPublishable } from "@/lib/teacher/publishable";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Publication et retrait d'une fiche.
 *
 * Publier ne rend pas forcément visible : la visibilité est dérivée à la
 * lecture et exige en plus un abonnement en cours. Un prof sans abonnement
 * peut donc préparer et publier sa fiche — elle apparaîtra dès la
 * souscription, sans qu'aucun webhook n'ait à réécrire son statut.
 */

const bodySchema = z.object({
  publish: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    if (!parsed.data.publish) {
      const profile = await prisma.teacherProfile.update({
        where: { id: teacher.teacherId },
        data: { status: "DRAFT", publishedAt: null },
        select: { status: true, publishedAt: true, slug: true },
      });

      // Sans effet tant que la page publique est rendue à la demande, mais
      // indispensable le jour où elle passera en ISR : dépublier doit prendre
      // effet immédiatement, pas à la prochaine régénération.
      revalidatePath(`/profs/${profile.slug}`);

      return NextResponse.json(profile);
    }

    const profile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherId },
      select: {
        headline: true,
        bio: true,
        hourlyRateCents: true,
        teachesOnline: true,
        teachesInPerson: true,
        teachesAtHome: true,
        city: true,
        _count: { select: { instruments: true, rules: true } },
      },
    });

    // Même fonction que celle qui alimente le formulaire : les deux ne peuvent
    // pas diverger.
    const check = checkPublishable({
      headline: profile.headline,
      bio: profile.bio,
      hourlyRateCents: profile.hourlyRateCents,
      teachesOnline: profile.teachesOnline,
      teachesInPerson: profile.teachesInPerson,
      teachesAtHome: profile.teachesAtHome,
      city: profile.city,
      instrumentCount: profile._count.instruments,
      availabilityRuleCount: profile._count.rules,
    });

    if (!check.ok) {
      return NextResponse.json(
        { error: "Fiche incomplète", missing: check.missing },
        { status: 409 }
      );
    }

    const published = await prisma.teacherProfile.update({
      where: { id: teacher.teacherId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      select: { status: true, publishedAt: true, slug: true },
    });

    revalidatePath(`/profs/${published.slug}`);

    return NextResponse.json(published);
  } catch (error) {
    console.error("[TEACHER_PUBLISH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
