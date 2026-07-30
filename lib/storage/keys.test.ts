import { describe, expect, it } from "vitest";

import { avatarKey } from "./keys";

describe("avatarKey", () => {
  it("range les avatars sous un préfixe dédié, en .webp", () => {
    expect(avatarKey("abc123")).toBe("avatars/abc123.webp");
  });

  it("est stable pour un même utilisateur (un nouvel upload écrase l'ancien)", () => {
    expect(avatarKey("u1")).toBe(avatarKey("u1"));
  });

  it("distingue deux utilisateurs", () => {
    expect(avatarKey("u1")).not.toBe(avatarKey("u2"));
  });
});
