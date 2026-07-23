import { describe, expect, it } from "vitest";

import { buildReminders, type ReminderContext } from "@/lib/notifications/reminders";
import {
  REMINDER_LEAD_HOURS,
  reminderWindow,
  shouldRemind,
  type RemindableBooking,
} from "./schedule";

const HOUR = 3_600_000;
const NOW = new Date("2026-07-23T08:00:00Z");

const booking = (overrides: Partial<RemindableBooking> = {}): RemindableBooking => ({
  status: "CONFIRMED",
  startsAt: new Date(NOW.getTime() + 10 * HOUR),
  reminded: false,
  ...overrides,
});

describe("reminderWindow", () => {
  it("part de maintenant, pas de 24 h avant le cours", () => {
    const { from, to } = reminderWindow(NOW);

    expect(from).toEqual(NOW);
    expect(to.getTime() - NOW.getTime()).toBe(REMINDER_LEAD_HOURS * HOUR);
  });
});

describe("shouldRemind", () => {
  it("rappelle un cours confirmé dans la fenêtre", () => {
    expect(shouldRemind(booking(), NOW)).toBe(true);
  });

  /**
   * Le cas qui justifie la forme de la fenêtre : si la tâche n'a pas tourné
   * depuis six heures, un cours qui devait être rappelé à H-24 et se tient
   * maintenant dans 18 h doit quand même partir. Une fenêtre centrée sur
   * H-24 l'aurait perdu sans rien signaler.
   */
  it("rattrape un cours qu'une tâche en retard aurait manqué", () => {
    const late = booking({ startsAt: new Date(NOW.getTime() + 18 * HOUR) });

    expect(shouldRemind(late, NOW)).toBe(true);
  });

  it("ignore un cours au-delà de la fenêtre", () => {
    const far = booking({
      startsAt: new Date(NOW.getTime() + (REMINDER_LEAD_HOURS + 1) * HOUR),
    });

    expect(shouldRemind(far, NOW)).toBe(false);
  });

  it("accepte un cours pile à la borne haute", () => {
    const edge = booking({
      startsAt: new Date(NOW.getTime() + REMINDER_LEAD_HOURS * HOUR),
    });

    expect(shouldRemind(edge, NOW)).toBe(true);
  });

  it("ignore un cours déjà commencé", () => {
    expect(shouldRemind(booking({ startsAt: NOW }), NOW)).toBe(false);
    expect(
      shouldRemind(booking({ startsAt: new Date(NOW.getTime() - HOUR) }), NOW)
    ).toBe(false);
  });

  it("ne rappelle jamais deux fois", () => {
    expect(shouldRemind(booking({ reminded: true }), NOW)).toBe(false);
  });

  it.each(["PENDING", "CANCELLED", "DECLINED", "COMPLETED", "NO_SHOW"] as const)(
    "ignore un cours en %s",
    (status) => {
      expect(shouldRemind(booking({ status }), NOW)).toBe(false);
    }
  );
});

const CONTEXT: ReminderContext = {
  teacherName: "Camille Rossi",
  teacherEmail: "prof@example.com",
  studentName: "Louis Bernard",
  studentEmail: "eleve@example.com",
  instrumentName: "Chant",
  startsAt: new Date("2026-08-03T07:00:00Z"),
  timezone: "Europe/Paris",
  isTrial: false,
  mode: "ONLINE",
  appUrl: "https://noteva.fr",
};

describe("buildReminders", () => {
  it("prévient les deux parties", () => {
    const mails = buildReminders(CONTEXT);

    expect(mails.map((m) => m.to).sort()).toEqual([
      "eleve@example.com",
      "prof@example.com",
    ]);
  });

  it("donne la même heure aux deux, celle du prof", () => {
    const [student, teacher] = buildReminders(CONTEXT);

    // 07:00 UTC = 09:00 à Paris en août.
    expect(student.text).toContain("09:00");
    expect(teacher.text).toContain("09:00");
  });

  it("garde l'heure du prof même pour un élève ailleurs", () => {
    const [student] = buildReminders({ ...CONTEXT, timezone: "Europe/Paris" });
    const [tokyo] = buildReminders({ ...CONTEXT, timezone: "Asia/Tokyo" });

    // Le fuseau qui compte est celui du cours, pas celui du lecteur.
    expect(student.text).toContain("09:00");
    expect(tokyo.text).toContain("16:00");
  });

  /**
   * Un cours confirmé trois heures avant son début entre aussi dans la
   * fenêtre. Le mot « demain » serait alors faux — d'où une date explicite.
   */
  it("n'emploie jamais de terme relatif", () => {
    for (const mail of buildReminders(CONTEXT)) {
      expect(mail.subject.toLowerCase()).not.toContain("demain");
      expect(mail.text.toLowerCase()).not.toContain("demain");
      expect(mail.subject).toContain("3 août");
    }
  });

  it("donne le lien de visio à qui doit s'y connecter", () => {
    const mails = buildReminders({
      ...CONTEXT,
      meetingUrl: "https://meet.example.com/abc",
    });

    for (const mail of mails) {
      expect(mail.text).toContain("https://meet.example.com/abc");
    }
  });

  it("donne l'adresse en présentiel plutôt qu'un lien", () => {
    const mails = buildReminders({
      ...CONTEXT,
      mode: "TEACHER_PLACE",
      address: "12 rue de la Muette, Lyon",
      meetingUrl: "https://meet.example.com/abc",
    });

    for (const mail of mails) {
      expect(mail.text).toContain("12 rue de la Muette");
      expect(mail.text).not.toContain("meet.example.com");
    }
  });

  it("ne laisse pas de ligne vide quand ni lien ni adresse", () => {
    for (const mail of buildReminders(CONTEXT)) {
      expect(mail.text).not.toContain("Lien : \n");
      expect(mail.text).not.toContain("Adresse : \n");
    }
  });

  it("mentionne l'essai quand c'en est un", () => {
    for (const mail of buildReminders({ ...CONTEXT, isTrial: true })) {
      expect(mail.text).toContain("cours d'essai");
    }
  });

  it("porte un lien absolu vers l'espace de chacun", () => {
    const [student, teacher] = buildReminders(CONTEXT);

    expect(student.text).toContain("https://noteva.fr/dashboard/cours");
    expect(teacher.text).toContain("https://noteva.fr/dashboard/prof");
  });

  it("reste lisible sans nom renseigné", () => {
    const mails = buildReminders({
      ...CONTEXT,
      teacherName: null,
      studentName: null,
    });

    for (const mail of mails) {
      expect(mail.text).not.toContain("null");
      expect(mail.text).not.toContain("undefined");
    }
  });
});
