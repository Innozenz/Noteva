import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { avatarKey } from "@/lib/storage/keys";
import { deletePublic, uploadPublic } from "@/lib/storage/objects";
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
} from "@/lib/user/photo-constants";
import { processAvatar } from "@/lib/user/photo";

/**
 * Photo de profil de l'utilisateur connecté.
 *
 * Écrit `User.image` (identité partagée, déjà lue partout — en-tête, fiche
 * publique, recherche). Toujours « ma » photo : l'id vient de la session, aucun
 * identifiant n'est accepté en paramètre.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté : envoyez un JPEG, un PNG ou un WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Image trop lourde : 5 Mo au maximum." },
        { status: 400 }
      );
    }

    const input = Buffer.from(await file.arrayBuffer());

    let processed: Buffer;
    try {
      processed = await processAvatar(input);
    } catch {
      // sharp lève sur une entrée qui n'est pas une vraie image, quel que soit
      // le type MIME déclaré : dernière barrière avant le stockage.
      return NextResponse.json(
        { error: "Image illisible ou corrompue." },
        { status: 400 }
      );
    }

    const url = await uploadPublic({
      key: avatarKey(session.user.id),
      body: processed,
      contentType: "image/webp",
    });

    // La clé est stable : on versionne l'URL pour casser le cache du navigateur
    // à chaque nouvelle photo (sinon l'ancienne resterait affichée).
    const versioned = `${url}?v=${Date.now()}`;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: versioned },
    });

    return NextResponse.json({ image: versioned });
  } catch (error) {
    console.error("[USER_PHOTO_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    // Suppression au mieux : si l'objet a déjà disparu, on nettoie quand même la
    // colonne. L'inverse (colonne vidée mais objet resté) serait sans gravité.
    try {
      await deletePublic(avatarKey(session.user.id));
    } catch (error) {
      console.error("[USER_PHOTO_DELETE_OBJECT_ERROR]", error);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: null },
    });

    return NextResponse.json({ image: null });
  } catch (error) {
    console.error("[USER_PHOTO_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
