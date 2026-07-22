import { describe, expect, it } from "vitest";

import {
  checkTransition,
  isLateCancellation,
  TERMINAL_STATUSES,
  TRANSITIONS,
  type Actor,
  type BookingAction,
} from "./transitions";

const START = new Date("2026-07-27T09:00:00Z");
const END = new Date("2026-07-27T10:00:00Z");
const BEFORE = new Date("2026-07-20T09:00:00Z");
const DURING = new Date("2026-07-27T09:30:00Z");
const AFTER = new Date("2026-07-27T11:00:00Z");

function check(
  action: BookingAction,
  currentStatus: Parameters<typeof checkTransition>[0]["currentStatus"],
  actor: Actor,
  now = BEFORE
) {
  return checkTransition({
    action,
    currentStatus,
    actor,
    startsAt: START,
    endsAt: END,
    now,
  });
}

describe("checkTransition", () => {
  it("laisse le prof confirmer une demande en attente", () => {
    const result = check("confirm", "PENDING", "teacher");

    expect(result.ok).toBe(true);
    expect(result.ok && result.rule.to).toBe("CONFIRMED");
  });

  it("interdit à l'élève de confirmer son propre cours", () => {
    const result = check("confirm", "PENDING", "student");

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("laisse le prof refuser une demande", () => {
    expect(check("decline", "PENDING", "teacher").ok).toBe(true);
  });

  it("interdit de refuser un cours déjà confirmé", () => {
    const result = check("decline", "CONFIRMED", "teacher");

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("laisse les deux parties annuler, avant comme après confirmation", () => {
    for (const actor of ["teacher", "student"] as Actor[]) {
      expect(check("cancel", "PENDING", actor).ok).toBe(true);
      expect(check("cancel", "CONFIRMED", actor).ok).toBe(true);
    }
  });

  it("refuse toute action depuis un état terminal", () => {
    for (const status of TERMINAL_STATUSES) {
      const result = check("cancel", status, "teacher");

      expect(result).toMatchObject({ ok: false, status: 409 });
      expect(result.ok === false && result.error).toMatch(/déjà/);
    }
  });

  it("n'autorise `complete` qu'une fois le cours terminé", () => {
    expect(check("complete", "CONFIRMED", "teacher", DURING)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(check("complete", "CONFIRMED", "teacher", AFTER).ok).toBe(true);
  });

  it("n'autorise `no_show` qu'une fois le cours commencé", () => {
    expect(check("no_show", "CONFIRMED", "teacher", BEFORE)).toMatchObject({
      ok: false,
      status: 409,
    });
    // Constatable dès le cours commencé, sans attendre la fin.
    expect(check("no_show", "CONFIRMED", "teacher", DURING).ok).toBe(true);
  });

  it("n'autorise `complete` que depuis CONFIRMED", () => {
    expect(check("complete", "PENDING", "teacher", AFTER)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("vérifie le rôle avant l'état", () => {
    // Un élève sur une action réservée au prof obtient 403, pas 409, même
    // quand l'état rendrait l'action impossible de toute façon.
    expect(check("complete", "PENDING", "student", AFTER)).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("ne laisse aucune transition partir d'un état terminal", () => {
    for (const rule of Object.values(TRANSITIONS)) {
      for (const from of rule.from) {
        expect(TERMINAL_STATUSES).not.toContain(from);
      }
    }
  });
});

describe("isLateCancellation", () => {
  const cancellationWindowHours = 24;

  it("est tardive dans la fenêtre de préavis", () => {
    expect(
      isLateCancellation({
        startsAt: START,
        now: new Date("2026-07-27T00:00:00Z"), // 9 h avant
        cancellationWindowHours,
      })
    ).toBe(true);
  });

  it("ne l'est pas au-delà du préavis", () => {
    expect(
      isLateCancellation({
        startsAt: START,
        now: new Date("2026-07-25T09:00:00Z"), // 48 h avant
        cancellationWindowHours,
      })
    ).toBe(false);
  });

  it("ne l'est pas exactement à la limite", () => {
    expect(
      isLateCancellation({
        startsAt: START,
        now: new Date("2026-07-26T09:00:00Z"), // pile 24 h avant
        cancellationWindowHours,
      })
    ).toBe(false);
  });
});
