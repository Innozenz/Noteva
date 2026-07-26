import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { describeIssues, type FieldLabels } from "@/lib/http/validation";
import prisma from "@/lib/prisma";
import { composeName, splitFullName } from "@/lib/user/name";

/**
 * Identité de l'utilisateur connecté : prénom et nom.
 *
 * Toujours « mon » compte — aucun identifiant n'est accepté en paramètre, donc
 * l'autorisation se réduit à « y a-t-il une session ». Contrairement aux
 * espaces prof et élève, aucun rôle n'est exigé : quelqu'un qui n'a pas terminé
 * son onboarding a un nom, lui aussi.
 *
 * L'e-mail n'est volontairement pas modifiable ici. Le changer demande de
 * revérifier l'adresse — sans quoi on peut déplacer un compte vers une boîte
 * qu'on ne possède pas —, et Better Auth a un parcours dédié pour ça. Un champ
 * qui écrirait la colonne directement serait une prise de contrôle de compte.
 */

const FIELD_LABELS: FieldLabels = {
  firstName: "Prénom",
  lastName: "Nom",
};

const bodySchema = z.object({
  // Le prénom est le seul obligatoire : c'est lui qui signe les avis et sert
  // aux salutations. Exiger aussi un nom de famille exclurait les gens qui
  // n'en portent qu'un.
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();

    if ("error" in user) {
      return NextResponse.json({ error: user.error }, { status: user.status });
    }

    return NextResponse.json(await readIdentity(user.id));
  } catch (error) {
    console.error("[USER_IDENTITY_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();

    if ("error" in user) {
      return NextResponse.json({ error: user.error }, { status: user.status });
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: describeIssues(parsed.error.issues, FIELD_LABELS),
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { firstName, lastName } = parsed.data;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName: lastName || null,
        // L'invariant : `name` est recomposé dans la même écriture. C'est ce
        // qui permet à Better Auth et à toutes les lectures existantes de
        // continuer à lire un seul champ, sans resynchronisation à faire
        // ailleurs — donc sans possibilité de dérive.
        name: composeName(firstName, lastName),
      },
    });

    return NextResponse.json(await readIdentity(user.id));
  } catch (error) {
    console.error("[USER_IDENTITY_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: "Non authentifié", status: 401 } as const;
  }

  return { id: session.user.id } as const;
}

/**
 * Rend l'identité telle que le formulaire doit l'afficher.
 *
 * Un compte qui n'a jamais rien saisi n'a que `name` : on l'amorce par le
 * découpage plutôt que de présenter deux champs vides à quelqu'un dont
 * l'application connaît déjà le nom.
 */
async function readIdentity(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, firstName: true, lastName: true },
  });

  const fallback = splitFullName(user.name);

  return {
    email: user.email,
    firstName: user.firstName ?? fallback.firstName,
    lastName: user.lastName ?? fallback.lastName,
  };
}
