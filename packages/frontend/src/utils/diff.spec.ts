import { describe, expect, it } from "vitest";

import { buildLineDiff } from "./diff";

const kinds = (before: string, after: string) =>
  buildLineDiff(before, after).lines.map((line) => line.kind);

describe("comparing two versions of a message", () => {
  it("reports nothing changed when nothing changed", () => {
    const diff = buildLineDiff("a\nb\nc", "a\nb\nc");

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(kinds("a\nb\nc", "a\nb\nc")).toStrictEqual(["Same", "Same", "Same"]);
  });

  it("marks an inserted line without disturbing its neighbours", () => {
    expect(kinds("a\nc", "a\nb\nc")).toStrictEqual(["Same", "Added", "Same"]);
  });

  it("marks a removed line", () => {
    expect(kinds("a\nb\nc", "a\nc")).toStrictEqual(["Same", "Removed", "Same"]);
  });

  it("shows a changed line as a removal and an addition", () => {
    const diff = buildLineDiff("a\nb\nc", "a\nB\nc");

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
  });

  it("keeps every line of the new version somewhere in the diff", () => {
    const after = "one\ntwo\nthree\nfour";
    const diff = buildLineDiff("one\nthree", after);
    const kept = diff.lines
      .filter((line) => line.kind !== "Removed")
      .map((line) => line.text)
      .join("\n");

    expect(kept).toBe(after);
  });

  it("keeps every line of the old version somewhere in the diff", () => {
    const before = "one\ntwo\nthree\nfour";
    const diff = buildLineDiff(before, "one\nthree");
    const kept = diff.lines
      .filter((line) => line.kind !== "Added")
      .map((line) => line.text)
      .join("\n");

    expect(kept).toBe(before);
  });

  it("handles one side being empty", () => {
    expect(buildLineDiff("", "a\nb").added).toBe(2);
    expect(buildLineDiff("a\nb", "").removed).toBe(2);
  });

  it("says so rather than hanging when the changed band is enormous", () => {
    const before = Array.from({ length: 4000 }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: 4000 }, (_, i) => `b${i}`).join("\n");

    const diff = buildLineDiff(before, after);

    expect(diff.isApproximate).toBe(true);
    expect(diff.added).toBe(4000);
    expect(diff.removed).toBe(4000);
  });

  it("stays exact for a realistic message-sized change", () => {
    const before = Array.from({ length: 300 }, (_, i) => `line ${i}`).join(
      "\n",
    );
    const after = before.replace("line 150", "line 150 changed");

    const diff = buildLineDiff(before, after);

    expect(diff.isApproximate).toBe(false);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
  });
});
