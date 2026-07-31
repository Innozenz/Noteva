"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Image = { id: string; filename: string };

/**
 * Galerie d'images d'un compte rendu, avec visionneuse plein écran.
 *
 * Îlot client : les vignettes ouvrent une lightbox où l'on navigue d'une image
 * à l'autre (flèches, clavier, molette au clavier). Les images sont servies par
 * la route d'accès qui vérifie le participant — l'`src` pointe dessus, jamais
 * sur l'objet privé en direct.
 */
export function ReportImages({ images, base }: { images: Image[]; base: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  const src = (id: string) => `${base}/${id}`;

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)),
    [images.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % images.length)),
    [images.length]
  );

  // Clavier + verrou du défilement tant que la visionneuse est ouverte.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") prev();
      else if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close, prev, next]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setIndex(i)}
            className="block overflow-hidden rounded-lg border border-border transition hover:border-border-strong"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src(image.id)}
              alt={image.filename}
              className="h-28 w-28 object-cover transition hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image en plein écran"
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                prev();
              }}
              aria-label="Image précédente"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          <figure
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full max-w-full flex-col items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src(images[index].id)}
              alt={images[index].filename}
              className="max-h-[82vh] max-w-[90vw] rounded-lg object-contain"
            />
            <figcaption className="flex items-center gap-2 text-sm text-white/80">
              <span className="max-w-[60vw] truncate">{images[index].filename}</span>
              {images.length > 1 ? (
                <span className="text-white/50">
                  · {index + 1} / {images.length}
                </span>
              ) : null}
            </figcaption>
          </figure>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                next();
              }}
              aria-label="Image suivante"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
