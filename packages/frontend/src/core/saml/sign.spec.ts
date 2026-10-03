// @vitest-environment jsdom
import { err, ok, type Result } from "shared";
import { describe, expect, it } from "vitest";

import { buildSignedDocument, type SignRequest } from "./sign";
import { readSignatures } from "./verify";
import { parseXml } from "./xml";

import { buildCertificate } from "@/tests/certificateService";

const RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1"><saml:Issuer>https://idp.example.com</saml:Issuer><saml:Assertion ID="_a1"><saml:Subject><saml:NameID>bob@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const request = (overrides: Partial<SignRequest> = {}): SignRequest => ({
  document: documentOf(RESPONSE),
  targetId: "_r1",
  certificate: buildCertificate("cert-id"),
  signatureAlgorithm: "SHA-256",
  digestAlgorithm: "SHA-256",
  ...overrides,
});

const signsTo = (value: string) => () => Promise.resolve(ok(value));

const acceptsEverything = () => Promise.resolve(ok(true));

describe("refusing before anything is written", () => {
  it("reports a target that is not in the document", async () => {
    const outcome = await buildSignedDocument(
      request({ targetId: "_absent" }),
      signsTo("c2ln"),
      acceptsEverything,
    );

    expect(outcome).toEqual({
      kind: "Failed",
      failure: { kind: "ReferenceNotFound", id: "_absent" },
    });
  });

  it("refuses a duplicated identifier rather than signing one of them", async () => {
    const outcome = await buildSignedDocument(
      request({
        document: documentOf(`<r><a ID="_dup"/><b ID="_dup"/></r>`),
        targetId: "_dup",
      }),
      signsTo("c2ln"),
      acceptsEverything,
    );

    expect(outcome).toEqual({
      kind: "Failed",
      failure: { kind: "DuplicateId", id: "_dup", count: 2 },
    });
  });

  it("surfaces a refusal from the signer", async () => {
    const outcome = await buildSignedDocument(
      request(),
      () => Promise.resolve(err<string>("no private key is stored")),
      acceptsEverything,
    );

    expect(outcome).toEqual({
      kind: "Failed",
      failure: { kind: "SigningRefused", message: "no private key is stored" },
    });
  });
});

describe("the document it produces", () => {
  const signed = async () =>
    buildSignedDocument(request(), signsTo("c2ln"), acceptsEverything);

  it("leaves the caller's document untouched", async () => {
    const original = documentOf(RESPONSE);
    await buildSignedDocument(
      request({ document: original }),
      signsTo("c2ln"),
      acceptsEverything,
    );

    expect(readSignatures(original)).toHaveLength(0);
  });

  it("places the signature immediately after Issuer", async () => {
    const outcome = await signed();
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    const root = documentOf(outcome.xml).documentElement;
    expect(Array.from(root.children).map((child) => child.localName)).toEqual([
      "Issuer",
      "Signature",
      "Assertion",
    ]);
    expect(outcome.summary.placement).toBe("AfterIssuer");
  });

  it("places it first when the element carries no Issuer", async () => {
    const outcome = await buildSignedDocument(
      request({ document: documentOf(`<r ID="_r1"><a/></r>`) }),
      signsTo("c2ln"),
      acceptsEverything,
    );
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    const root = documentOf(outcome.xml).documentElement;

    expect(Array.from(root.children).map((child) => child.localName)).toEqual([
      "Signature",
      "a",
    ]);
    expect(outcome.summary.placement).toBe("FirstChild");
  });

  it("does not reuse a ds prefix that is already bound elsewhere", async () => {
    const outcome = await buildSignedDocument(
      request({
        document: documentOf(`<r xmlns:ds="urn:not:xmldsig" ID="_r1"><a/></r>`),
      }),
      signsTo("c2ln"),
      acceptsEverything,
    );
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    expect(outcome.xml).toContain('xmlns:ds="urn:not:xmldsig"');
    expect(outcome.xml).toMatch(/ds1:Signature/);
  });

  it("carries the certificate, the algorithms and the reference", async () => {
    const outcome = await signed();
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    expect(outcome.xml).toContain('URI="#_r1"');
    expect(outcome.xml).toContain(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    );
    expect(outcome.xml).toContain(
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
    );
    expect(outcome.xml).toContain("<ds:X509Certificate>");
  });
});

describe("checking its own output", () => {
  it("fails when its own output does not verify", async () => {
    const rejectsEverything = (): Promise<Result<boolean>> =>
      Promise.resolve(ok(false));

    const outcome = await buildSignedDocument(
      request(),
      signsTo("c2ln"),
      rejectsEverything,
    );

    expect(outcome.kind).toBe("Failed");
    expect(outcome.kind === "Failed" && outcome.failure.kind).toBe(
      "SelfVerificationFailed",
    );
  });
});
