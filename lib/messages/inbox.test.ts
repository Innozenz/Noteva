import { describe, expect, it } from "vitest";

import { buildInbox, type InboxMessage, type ThreadRead } from "./inbox";

const T1 = "t1";
const S1 = "s1";
const S2 = "s2";

function msg(patch: Partial<InboxMessage>): InboxMessage {
  return {
    teacherId: T1,
    studentId: S1,
    sender: "STUDENT",
    content: "coucou",
    hasAttachment: false,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    ...patch,
  };
}

describe("buildInbox", () => {
  it("regroupe par couple et retient le dernier message", () => {
    const convos = buildInbox(
      [
        msg({ studentId: S1, content: "un", createdAt: new Date("2026-01-01T10:00:00Z") }),
        msg({ studentId: S1, content: "deux", createdAt: new Date("2026-01-02T10:00:00Z") }),
        msg({ studentId: S2, content: "autre", createdAt: new Date("2026-01-03T10:00:00Z") }),
      ],
      [],
      "TEACHER"
    );

    expect(convos).toHaveLength(2);
    // Trié par dernier message décroissant : S2 (03) avant S1 (02).
    expect(convos[0].studentId).toBe(S2);
    expect(convos[1].last.content).toBe("deux");
  });

  it("compte comme non lus les messages de l'autre après le repère", () => {
    const reads: ThreadRead[] = [
      {
        teacherId: T1,
        studentId: S1,
        teacherReadAt: new Date("2026-01-01T12:00:00Z"),
        studentReadAt: null,
      },
    ];
    const messages = [
      // avant le repère → lu
      msg({ sender: "STUDENT", createdAt: new Date("2026-01-01T09:00:00Z") }),
      // après le repère → non lu
      msg({ sender: "STUDENT", createdAt: new Date("2026-01-01T13:00:00Z") }),
      // écrit par le prof lui-même → jamais « non lu » pour lui
      msg({ sender: "TEACHER", createdAt: new Date("2026-01-01T14:00:00Z") }),
    ];

    expect(buildInbox(messages, reads, "TEACHER")[0].unread).toBe(1);
  });

  it("sans repère de lecture, tout ce qui vient de l'autre est non lu", () => {
    const messages = [
      msg({ sender: "STUDENT" }),
      msg({ sender: "STUDENT" }),
      msg({ sender: "TEACHER" }),
    ];
    expect(buildInbox(messages, [], "TEACHER")[0].unread).toBe(2);
    // Côté élève, c'est le message du prof qui est non lu.
    expect(buildInbox(messages, [], "STUDENT")[0].unread).toBe(1);
  });
});
