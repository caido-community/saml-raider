// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { findElements, parseXml, readMessageInfo, serializeXml } from "./xml";

const RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ID="_r1"><saml:Issuer>https://idp.example.com</saml:Issuer><ds:Signature><ds:SignedInfo><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_a1"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/></ds:Reference></ds:SignedInfo><ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIC-base64</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Assertion ID="_a1"><saml:Subject><saml:NameID>alice@example.com</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T01:00:00Z"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T02:00:00Z"/></saml:Assertion></samlp:Response>`;

const parsed = (xml: string): Document => {
  const outcome = parseXml(xml);
  if (outcome.kind !== "Ok")
    throw new Error(`expected Ok, got ${outcome.kind}`);
  return outcome.document;
};

describe("parseXml", () => {
  it("parses well-formed XML", () => {
    expect(parseXml(RESPONSE).kind).toBe("Ok");
  });

  it("reports malformed XML rather than throwing", () => {
    expect(parseXml("<a><b></a>").kind).toBe("Malformed");
  });
});

describe("findElements", () => {
  it("matches on local name regardless of prefix", () => {
    const withPrefix = parsed('<r xmlns:x="urn:a"><x:Assertion/></r>');
    const withOther = parsed('<r xmlns:zz="urn:a"><zz:Assertion/></r>');
    const withNone = parsed("<r><Assertion/></r>");

    expect(findElements(withPrefix, "Assertion")).toHaveLength(1);
    expect(findElements(withOther, "Assertion")).toHaveLength(1);
    expect(findElements(withNone, "Assertion")).toHaveLength(1);
  });

  it("finds every match, not just the first", () => {
    const document = parsed("<r><A/><A/><A/></r>");

    expect(findElements(document, "A")).toHaveLength(3);
  });
});

describe("serializeXml", () => {
  it("round-trips namespace prefixes", () => {
    const output = serializeXml(parsed(RESPONSE));

    expect(output).toContain(
      'xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"',
    );
    expect(output).toContain("<saml:Issuer>");
  });
});

describe("readMessageInfo", () => {
  it("reads every field the Message Info panel shows", () => {
    expect(readMessageInfo(parsed(RESPONSE))).toStrictEqual({
      issuer: "https://idp.example.com",
      conditionNotBefore: "2026-01-01T00:00:00Z",
      conditionNotAfter: "2026-01-01T02:00:00Z",
      subject: "alice@example.com",
      subjectConfirmationNotBefore: "2026-01-01T00:00:00Z",
      subjectConfirmationNotAfter: "2026-01-01T01:00:00Z",
      signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      encryptionMethod: undefined,
      certificate: "MIIC-base64",
    });
  });

  it("returns undefined for every field on an unrelated document", () => {
    const info = readMessageInfo(parsed("<html><body/></html>"));

    expect(Object.values(info).every((value) => value === undefined)).toBe(
      true,
    );
  });

  it("works when the document uses no prefixes at all", () => {
    const document = parsed("<Response><Issuer>idp</Issuer></Response>");

    expect(readMessageInfo(document).issuer).toBe("idp");
  });
});
