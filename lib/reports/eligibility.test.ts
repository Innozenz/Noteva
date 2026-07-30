import { describe, expect, it } from "vitest";

import { canDocument } from "./eligibility";

const past = new Date("2026-07-30T09:00:00Z");
const now = new Date("2026-07-30T12:00:00Z");
const future = new Date("2026-07-30T15:00:00Z");

describe("canDocument", () => {
  it("autorise un cours confirmé et commencé", () => {
    expect(canDocument("CONFIRMED", past, now)).toBe(true);
  });

  it("autorise un cours terminé", () => {
    expect(canDocument("COMPLETED", past, now)).toBe(true);
  });

  it("refuse un cours confirmé mais pas encore commencé", () => {
    expect(canDocument("CONFIRMED", future, now)).toBe(false);
  });

  it("refuse une demande en attente", () => {
    expect(canDocument("PENDING", past, now)).toBe(false);
  });

  it("refuse un cours annulé, refusé ou non honoré", () => {
    expect(canDocument("CANCELLED", past, now)).toBe(false);
    expect(canDocument("DECLINED", past, now)).toBe(false);
    expect(canDocument("NO_SHOW", past, now)).toBe(false);
  });
});
