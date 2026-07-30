import { describe, expect, it } from "vitest";

import { resolveAttachmentType } from "./attachments";

describe("resolveAttachmentType", () => {
  it("classe une image", () => {
    expect(resolveAttachmentType("image/png")).toEqual({
      kind: "IMAGE",
      ext: "png",
      maxBytes: 10 * 1024 * 1024,
    });
  });

  it("classe un PDF comme partition", () => {
    expect(resolveAttachmentType("application/pdf")?.kind).toBe("SCORE");
  });

  it("ignore les codecs du type audio de MediaRecorder", () => {
    const t = resolveAttachmentType("audio/webm;codecs=opus");
    expect(t?.kind).toBe("AUDIO");
    expect(t?.ext).toBe("webm");
  });

  it("est insensible à la casse", () => {
    expect(resolveAttachmentType("IMAGE/JPEG")?.kind).toBe("IMAGE");
  });

  it("rejette un type inconnu", () => {
    expect(resolveAttachmentType("application/x-msdownload")).toBeNull();
  });
});
