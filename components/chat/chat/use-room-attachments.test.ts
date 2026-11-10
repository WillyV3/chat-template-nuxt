import { describe, expect, it } from "vitest";

import { routeFiles } from "./use-room-attachments";

const img = new File(["x"], "scene.jpg", { type: "image/jpeg" });
const pdf = new File(["x"], "report.pdf", { type: "application/pdf" });

describe("routeFiles", () => {
  it("with a host: the host gets every file AND images are inlined for vision", () => {
    expect(routeFiles([img, pdf], true)).toEqual({ host: [img, pdf], inline: [img], upload: [] });
  });

  it("without a host: images inline, everything else goes to the workspace upload", () => {
    expect(routeFiles([img, pdf], false)).toEqual({ host: [], inline: [img], upload: [pdf] });
  });
});
