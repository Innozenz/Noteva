import { describe, expect, it } from "vitest";

import {
  buildNotification,
  type BookingContext,
  type NotificationEvent,
} from "./templates";

const CONTEXT: BookingContext = {
  teacherName: "Camille Rossi",
  teacherEmail: "prof@example.com",
  studentName: "Louis Bernard",
  studentEmail: "eleve@example.com",
  instrumentName: "Chant",
  startsAt: new Date("2026-08-03T07:00:00Z"),
  timezone: "Europe/Paris",
  isTrial: false,
  appUrl: "https://noteva.fr",
};

const ALL_EVENTS: NotificationEvent[] = [
  "booking_requested",
  "booking_confirmed",
  "booking_declined",
  "booking_cancelled",
];

describe("buildNotification — destinataires", () => {
  it("prévient le prof d'une nouvelle demande", () => {
    const mail = buildNotification("booking_requested", CONTEXT, "student");

    expect(mail?.to).toBe("prof@example.com");
    expect(mail?.subject).toContain("Nouvelle demande");
  });

  it("prévient l'élève d'une confirmation", () => {
    expect(buildNotification("booking_confirmed", CONTEXT, "teacher")?.to).toBe(
      "eleve@example.com"
    );
  });

  it("prévient l'élève d'un refus", () => {
    expect(buildNotification("booking_declined", CONTEXT, "teacher")?.to).toBe(
      "eleve@example.com"
    );
  });

  it("prévient l'autre partie d'une annulation, dans les deux sens", () => {
    expect(buildNotification("booking_cancelled", CONTEXT, "teacher")?.to).toBe(
      "eleve@example.com"
    );
    expect(buildNotification("booking_cancelled", CONTEXT, "student")?.to).toBe(
      "prof@example.com"
    );
  });

  it("ne notifie jamais celui qui vient d'agir", () => {
    // Chaque notification part vers quelqu'un d'autre que l'acteur.
    for (const event of ALL_EVENTS) {
      for (const actor of ["teacher", "student"] as const) {
        const mail = buildNotification(event, CONTEXT, actor);
        if (!mail) continue;

        const ownEmail =
          actor === "teacher" ? CONTEXT.teacherEmail : CONTEXT.studentEmail;
        expect(mail.to).not.toBe(ownEmail);
      }
    }
  });

  it("ignore un événement déclenché par la mauvaise partie", () => {
    // Un prof ne dépose pas de demande, un élève ne confirme pas.
    expect(buildNotification("booking_requested", CONTEXT, "teacher")).toBeNull();
    expect(buildNotification("booking_confirmed", CONTEXT, "student")).toBeNull();
    expect(buildNotification("booking_declined", CONTEXT, "student")).toBeNull();
  });
});

describe("buildNotification — contenu", () => {
  it("donne l'heure dans le fuseau du prof", () => {
    const mail = buildNotification("booking_requested", CONTEXT, "student");

    // 07:00Z = 9 h à Paris en août.
    expect(mail?.text).toContain("09:00");
    expect(mail?.text).toContain("lundi 3 août 2026");
  });

  it("garde l'heure du prof même pour un élève ailleurs", () => {
    // Un cours a lieu à une heure : celle du prof. Deux heures différentes
    // selon le destinataire produirait des rendez-vous manqués.
    const mail = buildNotification("booking_confirmed", CONTEXT, "teacher");

    expect(mail?.text).toContain("09:00");
  });

  it("respecte un autre fuseau de prof", () => {
    const mail = buildNotification(
      "booking_requested",
      { ...CONTEXT, timezone: "America/Montreal" },
      "student"
    );

    expect(mail?.text).toContain("03:00");
  });

  it("signale un cours d'essai", () => {
    const mail = buildNotification(
      "booking_requested",
      { ...CONTEXT, isTrial: true },
      "student"
    );

    expect(mail?.text).toContain("cours d'essai");
  });

  it("reprend le message de l'élève quand il y en a un", () => {
    const mail = buildNotification(
      "booking_requested",
      { ...CONTEXT, studentMessage: "Débutant complet." },
      "student"
    );

    expect(mail?.text).toContain("Débutant complet.");
  });

  it("n'écrit pas de ligne « Message » vide", () => {
    const mail = buildNotification("booking_requested", CONTEXT, "student");

    expect(mail?.text).not.toContain("Message :");
  });

  it("reprend le motif d'annulation", () => {
    const mail = buildNotification(
      "booking_cancelled",
      { ...CONTEXT, cancellationReason: "Empêchement" },
      "teacher"
    );

    expect(mail?.text).toContain("Empêchement");
  });

  it("rappelle au prof que le créneau reste bloqué", () => {
    const mail = buildNotification("booking_requested", CONTEXT, "student");

    expect(mail?.text).toContain("bloqué");
  });

  it("construit des liens absolus", () => {
    for (const event of ALL_EVENTS) {
      for (const actor of ["teacher", "student"] as const) {
        const mail = buildNotification(event, CONTEXT, actor);
        if (!mail) continue;

        expect(mail.text).toContain("https://noteva.fr/");
        expect(mail.text).not.toContain("undefined");
      }
    }
  });

  it("se passe des noms manquants", () => {
    const anonymous = {
      ...CONTEXT,
      teacherName: null,
      studentName: null,
    };

    for (const event of ALL_EVENTS) {
      for (const actor of ["teacher", "student"] as const) {
        const mail = buildNotification(event, anonymous, actor);
        if (!mail) continue;

        expect(mail.text).not.toContain("null");
        expect(mail.subject).not.toContain("null");
      }
    }
  });
});
