import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@prisma/client";

import { groupBookings, isUrgent, type InboxBooking } from "./grouping";

const NOW = new Date("2026-07-22T12:00:00Z");

function booking(
  id: string,
  status: BookingStatus,
  startsAt: string,
  durationMin = 60
): InboxBooking {
  const start = new Date(startsAt);
  return {
    id,
    status,
    startsAt: start,
    endsAt: new Date(start.getTime() + durationMin * 60_000),
  };
}

describe("groupBookings", () => {
  it("range une demande à venir dans les demandes", () => {
    const groups = groupBookings(
      [booking("a", "PENDING", "2026-07-25T09:00:00Z")],
      NOW
    );

    expect(groups.pending.map((b) => b.id)).toEqual(["a"]);
  });

  it("bascule une demande dont l'heure est passée dans l'historique", () => {
    // Elle n'est plus à confirmer : le cours n'aura pas lieu.
    const groups = groupBookings(
      [booking("a", "PENDING", "2026-07-20T09:00:00Z")],
      NOW
    );

    expect(groups.pending).toHaveLength(0);
    expect(groups.past.map((b) => b.id)).toEqual(["a"]);
  });

  it("sépare les cours confirmés à venir de ceux à clôturer", () => {
    const groups = groupBookings(
      [
        booking("futur", "CONFIRMED", "2026-07-25T09:00:00Z"),
        booking("passe", "CONFIRMED", "2026-07-20T09:00:00Z"),
      ],
      NOW
    );

    expect(groups.upcoming.map((b) => b.id)).toEqual(["futur"]);
    expect(groups.toReview.map((b) => b.id)).toEqual(["passe"]);
  });

  it("traite un cours en train de se dérouler comme à venir", () => {
    const groups = groupBookings(
      [booking("encours", "CONFIRMED", "2026-07-22T11:30:00Z")],
      NOW
    );

    expect(groups.upcoming.map((b) => b.id)).toEqual(["encours"]);
  });

  it("classe les états terminaux dans l'historique", () => {
    const statuses: BookingStatus[] = [
      "CANCELLED",
      "DECLINED",
      "COMPLETED",
      "NO_SHOW",
    ];
    const groups = groupBookings(
      statuses.map((s, i) => booking(s, s, `2026-07-2${i + 3}T09:00:00Z`)),
      NOW
    );

    expect(groups.past).toHaveLength(4);
    expect(groups.pending.concat(groups.upcoming, groups.toReview)).toHaveLength(
      0
    );
  });

  it("met les demandes les plus proches en tête", () => {
    const groups = groupBookings(
      [
        booking("loin", "PENDING", "2026-08-10T09:00:00Z"),
        booking("proche", "PENDING", "2026-07-23T09:00:00Z"),
      ],
      NOW
    );

    expect(groups.pending.map((b) => b.id)).toEqual(["proche", "loin"]);
  });

  it("met les cours à clôturer du plus récent au plus ancien", () => {
    const groups = groupBookings(
      [
        booking("ancien", "CONFIRMED", "2026-07-01T09:00:00Z"),
        booking("recent", "CONFIRMED", "2026-07-21T09:00:00Z"),
      ],
      NOW
    );

    expect(groups.toReview.map((b) => b.id)).toEqual(["recent", "ancien"]);
  });

  it("rend quatre groupes vides sur une liste vide", () => {
    expect(groupBookings([], NOW)).toEqual({
      pending: [],
      upcoming: [],
      toReview: [],
      past: [],
    });
  });
});

describe("isUrgent", () => {
  it("signale une demande dont le cours approche", () => {
    expect(
      isUrgent(booking("a", "PENDING", "2026-07-23T12:00:00Z"), NOW)
    ).toBe(true);
  });

  it("ne signale pas une demande lointaine", () => {
    expect(
      isUrgent(booking("a", "PENDING", "2026-08-01T12:00:00Z"), NOW)
    ).toBe(false);
  });

  it("ne signale pas un cours déjà commencé", () => {
    expect(
      isUrgent(booking("a", "PENDING", "2026-07-22T11:00:00Z"), NOW)
    ).toBe(false);
  });

  it("ne signale que les demandes", () => {
    expect(
      isUrgent(booking("a", "CONFIRMED", "2026-07-23T12:00:00Z"), NOW)
    ).toBe(false);
  });
});
