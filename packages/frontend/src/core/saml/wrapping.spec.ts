import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { readWrappingRisk } from "./wrapping";
import { parseXml } from "./xml";

import {
  DUPLICATE_ID,
  EVIL_PARENT,
  EVIL_SIBLING_FIRST,
  ORIGINAL_INSIDE_SIGNATURE,
  REFERENCE_TO_NOTHING,
  UNWRAPPED,
  WRAPPED_IN_EXTENSIONS,
} from "@/tests/wrapping";

const riskOf = (xml: string) => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return readWrappingRisk(parsed.document);
};

describe("a message that is not wrapped", () => {
  it("reports no risk when the signed assertion is the one consumed", () => {
    expect(riskOf(UNWRAPPED)).toEqual({ kind: "None" });
  });

  it("reports the absence of a signature rather than a risk", () => {
    expect(
      riskOf(
        `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"/>`,
      ),
    ).toEqual({ kind: "NoSignature" });
  });
});

describe("wrapping variants", () => {
  /**
   * The classic wrap: two assertions share the identifier the signature names,
   * so which one a consumer resolves decides who it believes you are.
   */
  it("catches two assertions claiming the signed identifier", () => {
    expect(riskOf(DUPLICATE_ID)).toEqual({
      kind: "DuplicateId",
      id: "_a1",
      count: 2,
    });
  });

  /**
   * The signature is genuinely valid here. The danger is that it covers an
   * assertion a consumer taking the first one would never look at.
   */
  it("catches an unsigned assertion placed ahead of the signed one", () => {
    expect(riskOf(EVIL_SIBLING_FIRST)).toEqual({
      kind: "SignedElementNotConsumed",
      signedId: "_a1",
      consumedId: "_evil",
    });
  });

  it("catches the signed assertion nested inside an unsigned one", () => {
    expect(riskOf(EVIL_PARENT)).toEqual({
      kind: "SignedElementNotConsumed",
      signedId: "_a1",
      consumedId: "_evil",
    });
  });

  it("catches the signed assertion hidden inside the signature itself", () => {
    expect(riskOf(ORIGINAL_INSIDE_SIGNATURE).kind).toBe("UnresolvedReference");
  });

  it("catches the signed assertion moved into Extensions", () => {
    expect(riskOf(WRAPPED_IN_EXTENSIONS)).toEqual({
      kind: "SignedElementNotConsumed",
      signedId: "_a1",
      consumedId: "_evil",
    });
  });

  it("catches a reference that resolves to nothing", () => {
    expect(riskOf(REFERENCE_TO_NOTHING)).toEqual({
      kind: "UnresolvedReference",
      id: "_gone",
    });
  });
});

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

describe("messages whose signature covers the Response itself", () => {
  const responseSigned = (body: string) =>
    documentOf(
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1">` +
        `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>` +
        `<ds:Reference URI="#_r1"/></ds:SignedInfo></ds:Signature>${body}</samlp:Response>`,
    );

  it("does not cry wrapping on an ordinary Response-signed message", () => {
    expect(
      readWrappingRisk(
        responseSigned(
          `<saml:Assertion ID="_a1"><saml:Subject/></saml:Assertion>`,
        ),
      ),
    ).toStrictEqual({ kind: "None" });
  });

  it("still reports a duplicated Response id", () => {
    const document = documentOf(
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1">` +
        `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>` +
        `<ds:Reference URI="#_r1"/></ds:SignedInfo></ds:Signature>` +
        `<saml:Assertion ID="_r1"><saml:Subject/></saml:Assertion></samlp:Response>`,
    );

    expect(readWrappingRisk(document).kind).toBe("DuplicateId");
  });
});

describe("wraps that move the signed element out of the Response", () => {
  const goldenOf = (name: string) =>
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../tests/xsw",
        `${name}.xml`,
      ),
      "utf8",
    );

  it.each(["XSW1", "XSW2"] as const)(
    "%s names the wrapping instead of claiming the id resolves to nothing",
    (variant) => {
      const risk = readWrappingRisk(documentOf(goldenOf(variant)));

      expect(risk.kind).not.toBe("UnresolvedReference");
      expect(risk.kind).not.toBe("None");
    },
  );

  it("reports a nested signed copy as detached", () => {
    expect(readWrappingRisk(documentOf(goldenOf("XSW1")))).toStrictEqual({
      kind: "SignedElementDetached",
      signedId: "_r1",
    });
  });

  it("reports a relocated sibling copy as not consumed", () => {
    const risk = readWrappingRisk(documentOf(goldenOf("XSW2")));

    expect(risk.kind).toBe("SignedElementNotConsumed");
  });
});
