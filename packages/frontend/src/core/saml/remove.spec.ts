// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  buildDocumentWithoutAnySignature,
  readSignatureLocations,
} from "./remove";
import { readSignatures } from "./verify";
import { parseXml } from "./xml";

const DS = 'xmlns:ds="http://www.w3.org/2000/09/xmldsig#"';

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const signature = (uri: string) =>
  `<ds:Signature ${DS}><ds:SignedInfo><ds:Reference URI="${uri}"/></ds:SignedInfo></ds:Signature>`;

const remaining = (xml: string) => readSignatures(documentOf(xml)).length;

describe("listing signatures", () => {
  it("finds none in an unsigned document", () => {
    expect(readSignatureLocations(documentOf(`<r><a/></r>`))).toEqual([]);
  });

  it("reports what each signature covers and where it sits", () => {
    const document = documentOf(
      `<r ID="_r"><a ID="_a">${signature("#_a")}</a>${signature("#_r")}</r>`,
    );

    expect(readSignatureLocations(document)).toEqual([
      { index: 0, coveredId: "_a", parentPath: "r/a" },
      { index: 1, coveredId: "_r", parentPath: "r" },
    ]);
  });

  it("distinguishes siblings with the same name", () => {
    const document = documentOf(`<r><a/><a>${signature("#_x")}</a></r>`);

    expect(readSignatureLocations(document)[0]?.parentPath).toBe("r/a[2]");
  });
});

describe("removing selected signatures", () => {
  const document = () =>
    documentOf(
      `<r ID="_r"><a ID="_a">${signature("#_a")}</a>${signature("#_r")}</r>`,
    );

  it("removes every signature for the parity action", () => {
    expect(remaining(buildDocumentWithoutAnySignature(document()))).toBe(0);
  });

  /**
   * Removal must not disturb anything the remaining signature covers, or that
   * signature stops verifying for a reason the user never asked for.
   */
  it("keeps every unrelated element", () => {
    const xml = buildDocumentWithoutAnySignature(document());

    expect(xml).toContain('<a ID="_a"');
    expect(xml).toContain('ID="_r"');
  });

  it("does not modify the document it was given", () => {
    const original = document();
    buildDocumentWithoutAnySignature(original);

    expect(readSignatures(original)).toHaveLength(2);
  });

  it("removes a nested signature without removing its host", () => {
    const nested = documentOf(
      `<r><outer>${signature("#_o")}<inner>${signature("#_i")}</inner></outer></r>`,
    );

    const xml = buildDocumentWithoutAnySignature(nested);

    expect(remaining(xml)).toBe(0);
    expect(xml).toContain("<inner/>");
    expect(xml).toContain("<outer>");
  });
});
