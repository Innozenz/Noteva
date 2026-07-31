import { describe, expect, it } from "vitest";

import { isStudentNews, type StudentNewsBooking } from "./student-news";

const SEEN = new Date("2026-01-10T12:00:00Z");
const STUDENT = "user-student";
const TEACHER = "user-teacher";
const AFTER = new Date("2026-01-11T09:00:00Z");
const BEFORE = new Date("2026-01-09T09:00:00Z");

function booking(patch: Partial<StudentNewsBooking>): StudentNewsBooking {
  return {
    status: "PENDING",
    confirmedAt: null,
    cancelledAt: null,
    cancelledById: null,
    updatedAt: SEEN,
    ...patch,
  };
}

describe("isStudentNews", () => {
  it("signale une confirmation postérieure à la dernière visite", () => {
    expect(
      isStudentNews(
        booking({ status: "CONFIRMED", confirmedAt: AFTER }),
        SEEN,
        STUDENT
      )
    ).toBe(true);
  });

  it("ne signale pas une confirmation déjà vue", () => {
    expect(
      isStudentNews(
        booking({ status: "CONFIRMED", confirmedAt: BEFORE }),
        SEEN,
        STUDENT
      )
    ).toBe(false);
  });

  it("signale un refus via updatedAt", () => {
    expect(
      isStudentNews(booking({ status: "DECLINED", updatedAt: AFTER }), SEEN, STUDENT)
    ).toBe(true);
  });

  it("signale une annulation par le prof", () => {
    expect(
      isStudentNews(
        booking({ status: "CANCELLED", cancelledAt: AFTER, cancelledById: TEACHER }),
        SEEN,
        STUDENT
      )
    ).toBe(true);
  });

  it("ne signale pas l'annulation faite par l'élève lui-même", () => {
    expect(
      isStudentNews(
        booking({ status: "CANCELLED", cancelledAt: AFTER, cancelledById: STUDENT }),
        SEEN,
        STUDENT
      )
    ).toBe(false);
  });

  it("ne signale ni une demande en attente ni un cours terminé", () => {
    expect(isStudentNews(booking({ status: "PENDING" }), SEEN, STUDENT)).toBe(
      false
    );
    expect(
      isStudentNews(booking({ status: "COMPLETED", updatedAt: AFTER }), SEEN, STUDENT)
    ).toBe(false);
  });
});
