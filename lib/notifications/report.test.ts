import { describe, expect, it } from "vitest";

import { buildReportNotifications, type ReportContext } from "./report";

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
  reason: "OFFENSIVE",
  detail: null,
  teacherName: "Camille Roy",
  instrumentName: "piano",
  rating: 1,
  comment: "Commentaire litigieux",
  ...overrides,
});

const APP_URL = "https://noteva.fr";

describe("notification de signalement", () => {
  it("écrit un message par administrateur", () => {
    const notifications = buildReportNotifications(
      ["a@example.test", "b@example.test"],
      context(),
      APP_URL
    );

    expect(notifications.map((n) => n.to)).toEqual([
      "a@example.test",
      "b@example.test",
    ]);
  });

  it("n'écrit rien quand personne n'est administrateur", () => {
    expect(buildReportNotifications([], context(), APP_URL)).toEqual([]);
  });

  it("donne le motif en français, jamais l'identifiant technique", () => {
    const [notification] = buildReportNotifications(
      ["a@example.test"],
      context({ reason: "PRIVACY" }),
      APP_URL
    );

    expect(notification.text).toContain("Divulgue des informations personnelles");
    expect(notification.text).not.toContain("PRIVACY");
  });

  it("dit que l'avis est toujours en ligne", () => {
    // Un signalement ne masque rien. Laisser croire l'inverse ferait classer
    // l'affaire sans que personne n'ait décidé.
    const [notification] = buildReportNotifications(
      ["a@example.test"],
      context(),
      APP_URL
    );

    expect(notification.text).toContain("toujours en ligne");
  });

  it("mène à la file de modération avec l'URL publique", () => {
    const [notification] = buildReportNotifications(
      ["a@example.test"],
      context(),
      APP_URL
    );

    expect(notification.text).toContain(`${APP_URL}/admin/avis`);
  });

  it("reprend la précision du prof quand il en donne une", () => {
    const [avec] = buildReportNotifications(
      ["a@example.test"],
      context({ detail: "L'élève n'est jamais venu" }),
      APP_URL
    );
    const [sans] = buildReportNotifications(
      ["a@example.test"],
      context({ detail: null }),
      APP_URL
    );

    expect(avec.text).toContain("L'élève n'est jamais venu");
    expect(sans.text).not.toContain("Précision");
  });

  it("gère une note sans commentaire", () => {
    const [notification] = buildReportNotifications(
      ["a@example.test"],
      context({ comment: null }),
      APP_URL
    );

    expect(notification.text).toContain("Note sans commentaire");
  });
});