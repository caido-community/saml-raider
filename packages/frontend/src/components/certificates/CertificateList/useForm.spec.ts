import { type Certificate } from "shared";
import { describe, expect, it } from "vitest";

import { type CertificateRow, useForm } from "./useForm";

import { buildCertificate } from "@/tests/certificateService";

const build = (certificates: Certificate[], filter = "") =>
  useForm({
    certificates: () => certificates,
    filter: () => filter,
    select: () => undefined,
    clearFilter: () => undefined,
  });

const labelsAndDepths = (rows: CertificateRow[]) =>
  rows.map((row) => [row.certificate.label, row.depth]);

const withParent = (id: string, parentId?: string) =>
  buildCertificate(id, { label: id, parentId });

describe("arranging certificates as a tree", () => {
  it("nests a child under its parent and indents it", () => {
    const form = build([withParent("child", "root"), withParent("root")]);

    expect(labelsAndDepths(form.rows.value)).toEqual([
      ["root", 0],
      ["child", 1],
    ]);
  });

  it("sorts siblings by label rather than by insertion order", () => {
    const form = build([
      withParent("b", "root"),
      withParent("a", "root"),
      withParent("root"),
    ]);

    expect(labelsAndDepths(form.rows.value)).toEqual([
      ["root", 0],
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("treats a parent that is not stored as no parent at all", () => {
    const form = build([withParent("orphan", "missing")]);

    expect(labelsAndDepths(form.rows.value)).toEqual([["orphan", 0]]);
  });

  it("still lists every certificate when two claim each other as parent", () => {
    const form = build([withParent("a", "b"), withParent("b", "a")]);

    expect(form.rows.value).toHaveLength(2);
    expect(form.rows.value.map((row) => row.certificate.label).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("lists a certificate that is its own parent exactly once", () => {
    const form = build([withParent("self", "self")]);

    expect(form.rows.value).toHaveLength(1);
  });
});

describe("filtering", () => {
  it("keeps the ancestors of a match so the match stays reachable", () => {
    const form = build(
      [withParent("leaf", "root"), withParent("root")],
      "leaf",
    );

    expect(labelsAndDepths(form.rows.value)).toEqual([
      ["root", 0],
      ["leaf", 1],
    ]);
  });

  it("drops branches with no match", () => {
    const form = build([withParent("wanted"), withParent("other")], "wanted");

    expect(labelsAndDepths(form.rows.value)).toEqual([["wanted", 0]]);
  });

  it("matches on fingerprint, not just on label", () => {
    const certificate = buildCertificate("id", {
      label: "unrelated name",
      details: {
        ...buildCertificate("id").details,
        fingerprintSha256: "abcdef123456",
      },
    });

    expect(build([certificate], "abcdef").rows.value).toHaveLength(1);
    expect(build([certificate], "nomatch").rows.value).toHaveLength(0);
  });

  it("ignores surrounding whitespace and case", () => {
    const form = build([withParent("Wanted")], "  wAnTeD  ");

    expect(form.rows.value).toHaveLength(1);
  });

  it("reports whether a filter is active so the empty state can differ", () => {
    expect(build([withParent("a")]).hasFilter.value).toBe(false);
    expect(build([withParent("a")], "  ").hasFilter.value).toBe(false);
    expect(build([withParent("a")], "x").hasFilter.value).toBe(true);
  });
});
