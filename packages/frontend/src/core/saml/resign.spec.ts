// @vitest-environment jsdom
import { ok } from "shared";
import { describe, expect, it } from "vitest";

import { buildResignedDocument, type ResignPolicy } from "./resign";
import { readSignatures } from "./verify";
import { parseXml } from "./xml";

import { buildCertificate } from "@/tests/certificateService";

const DS = 'xmlns:ds="http://www.w3.org/2000/09/xmldsig#"';

const existingSignature = `<ds:Signature ${DS}><ds:SignedInfo><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_a1"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/></ds:Reference></ds:SignedInfo></ds:Signature>`;

const response = (body: string) =>
  `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1"><saml:Issuer>idp</saml:Issuer>${body}</samlp:Response>`;

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const policy = (overrides: Partial<ResignPolicy> = {}): ResignPolicy => ({
  certificate: buildCertificate("cert-id"),
  signatureAlgorithm: undefined,
  digestAlgorithm: undefined,
  isRemovingExistingSignatures: true,
  ...overrides,
});

const run = (document: Document, overrides: Partial<ResignPolicy> = {}) =>
  buildResignedDocument({
    document,
    target: "Assertion",
    policy: policy(overrides),
    sign: () => Promise.resolve(ok("c2ln")),
    verify: () => Promise.resolve(ok(true)),
  });

describe("choosing what to sign", () => {
  it("reports when the document holds no assertion", async () => {
    const outcome = await run(documentOf(response("")));

    expect(outcome).toEqual({ kind: "Failed", failure: { kind: "NoTargets" } });
  });

  it("refuses an assertion with no identifier rather than inventing one", async () => {
    const outcome = await run(
      documentOf(response(`${existingSignature}<saml:Assertion/>`)),
    );

    expect(outcome).toEqual({
      kind: "Failed",
      failure: { kind: "MissingId", localName: "Assertion" },
    });
  });

  it("signs every assertion in the message", async () => {
    const outcome = await run(
      documentOf(
        response(
          `${existingSignature}<saml:Assertion ID="_a1"/><saml:Assertion ID="_a2"/>`,
        ),
      ),
    );

    expect(outcome.kind === "Ok" && outcome.signedIds).toEqual(["_a1", "_a2"]);
  });

  it("signs the protocol root when asked for the message", async () => {
    const outcome = await buildResignedDocument({
      document: documentOf(response(`${existingSignature}`)),
      target: "Message",
      policy: policy(),
      sign: () => Promise.resolve(ok("c2ln")),
      verify: () => Promise.resolve(ok(true)),
    });

    expect(outcome.kind === "Ok" && outcome.signedIds).toEqual(["_r1"]);
  });
});

describe("inheriting algorithms", () => {
  it("takes them from the signature already on the message", async () => {
    const outcome = await run(
      documentOf(response(`${existingSignature}<saml:Assertion ID="_a1"/>`)),
    );

    expect(outcome.kind).toBe("Ok");
    expect(outcome.kind === "Ok" && outcome.xml).toContain(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    );
  });

  /**
   * Falling back silently would produce a signature the user did not ask for
   * and did not notice, using a different algorithm from the one on the wire.
   */
  it("refuses an inherited algorithm it does not support", async () => {
    const foreign = existingSignature.replace(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
    );

    const outcome = await run(
      documentOf(response(`${foreign}<saml:Assertion ID="_a1"/>`)),
    );

    expect(outcome).toEqual({
      kind: "Failed",
      failure: {
        kind: "InheritedAlgorithmUnsupported",
        uri: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
      },
    });
  });

  it("prefers an explicit choice over the inherited one", async () => {
    const outcome = await run(
      documentOf(response(`${existingSignature}<saml:Assertion ID="_a1"/>`)),
      { signatureAlgorithm: "SHA-512", digestAlgorithm: "SHA-512" },
    );

    expect(outcome.kind === "Ok" && outcome.xml).toContain(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
    );
  });
});

describe("existing signatures", () => {
  const document = () =>
    documentOf(response(`${existingSignature}<saml:Assertion ID="_a1"/>`));

  it("removes them first, matching upstream parity", async () => {
    const outcome = await run(document(), {
      isRemovingExistingSignatures: true,
    });
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    expect(readSignatures(documentOf(outcome.xml))).toHaveLength(1);
  });

  it("keeps them when the operation says so", async () => {
    const outcome = await run(document(), {
      isRemovingExistingSignatures: false,
    });
    if (outcome.kind !== "Ok") throw new Error("expected a signed document");

    expect(readSignatures(documentOf(outcome.xml))).toHaveLength(2);
  });

  it("does not modify the document it was given", async () => {
    const original = document();
    await run(original);

    expect(readSignatures(original)).toHaveLength(1);
  });
});
