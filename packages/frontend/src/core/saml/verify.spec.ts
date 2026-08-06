// @vitest-environment jsdom
import { err, ok, type Result } from "shared";
import { describe, expect, it } from "vitest";

import { buildReferenceDigest } from "./reference";
import { readSignatures, verifySignature } from "./verify";
import { parseXml } from "./xml";

const CERTIFICATE = "MIIBfakebase64";

const alwaysValid = (): Promise<Result<boolean>> => Promise.resolve(ok(true));

const documentOf = (xml: string): Document => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("fixture did not parse");
  return parsed.document;
};

const build = (options: {
  canonicalization?: string;
  signatureMethod?: string;
  digestMethod?: string;
  uri?: string;
  digestValue?: string;
  certificate?: string;
  extra?: string;
  transforms?: string;
}) => {
  const c14n =
    options.canonicalization ?? "http://www.w3.org/2001/10/xml-exc-c14n#";
  const signatureMethod =
    options.signatureMethod ??
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  const digestMethod =
    options.digestMethod ?? "http://www.w3.org/2001/04/xmlenc#sha256";
  const certificate = options.certificate ?? CERTIFICATE;

  return documentOf(
    `<r ID="_1"><a>x</a>${options.extra ?? ""}<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:SignedInfo><ds:CanonicalizationMethod Algorithm="${c14n}"/>` +
      `<ds:SignatureMethod Algorithm="${signatureMethod}"/>` +
      `<ds:Reference URI="${options.uri ?? "#_1"}">` +
      (options.transforms ??
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
          `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
          `</ds:Transforms>`) +
      `<ds:DigestMethod Algorithm="${digestMethod}"/>` +
      `<ds:DigestValue>${options.digestValue ?? "wrong"}</ds:DigestValue>` +
      `</ds:Reference></ds:SignedInfo><ds:SignatureValue>c2ln</ds:SignatureValue>` +
      `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certificate}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
      `</ds:Signature></r>`,
  );
};

const outcomeOf = (document: Document, verify = alwaysValid) => {
  const signature = readSignatures(document)[0];
  if (signature === undefined) throw new Error("no signature in fixture");
  return verifySignature(signature, verify);
};

describe("algorithm policy", () => {
  it("refuses an unsupported canonicalization", async () => {
    const outcome = await outcomeOf(
      build({
        canonicalization: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      }),
    );

    expect(outcome).toEqual({
      kind: "Unsupported",
      uri: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    });
  });

  it("refuses an unsupported signature method", async () => {
    const outcome = await outcomeOf(
      build({
        signatureMethod: "http://www.w3.org/2001/04/xmldsig-more#hmac-sha256",
      }),
    );

    expect(outcome.kind).toBe("Unsupported");
  });

  it("refuses an unsupported digest method", async () => {
    const outcome = await outcomeOf(
      build({ digestMethod: "http://www.w3.org/2001/04/xmlenc#ripemd160" }),
    );

    expect(outcome.kind).toBe("Unsupported");
  });
});

describe("reference resolution", () => {
  it("reports a reference that resolves to nothing", async () => {
    const outcome = await outcomeOf(build({ uri: "#_absent" }));

    expect(outcome).toEqual({
      kind: "Unverifiable",
      reason: "ReferenceMissing",
    });
  });

  it("refuses a reference that is not a same-document fragment", async () => {
    const outcome = await outcomeOf(build({ uri: "https://elsewhere/#_1" }));

    expect(outcome).toEqual({
      kind: "Unverifiable",
      reason: "ReferenceMissing",
    });
  });

  /**
   * A wrapped document carries the signed element twice. Resolving the first
   * silently would verify a payload the signature never covered.
   */
  it("refuses a duplicated identifier rather than choosing one", async () => {
    const outcome = await outcomeOf(build({ extra: `<clone ID="_1"/>` }));

    expect(outcome).toEqual({
      kind: "Unverifiable",
      reason: "ReferenceAmbiguous",
    });
  });
});

describe("integrity", () => {
  it("reports a digest that does not match the covered content", async () => {
    const outcome = await outcomeOf(build({ digestValue: "not-the-digest" }));

    expect(outcome).toEqual({ kind: "Invalid", reason: "DigestMismatch" });
  });
});

describe("key material", () => {
  it("reports a signature carrying no certificate", async () => {
    const withoutCertificate = build({ certificate: "" });
    const signature = readSignatures(withoutCertificate)[0];
    if (signature === undefined) throw new Error("no signature in fixture");

    const digestValue = await buildReferenceDigest({
      element: withoutCertificate.documentElement,
      omit: signature,
      algorithm: "SHA-256",
      inclusivePrefixes: new Set<string>(),
    });

    const outcome = await outcomeOf(build({ certificate: "", digestValue }));

    expect(outcome).toEqual({ kind: "Unverifiable", reason: "NoCertificate" });
  });
});

describe("structure", () => {
  it("reports a signature missing its SignedInfo", async () => {
    const document = documentOf(
      `<r ID="_1"><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignatureValue>c2ln</ds:SignatureValue></ds:Signature></r>`,
    );

    expect(await outcomeOf(document)).toEqual({
      kind: "Unverifiable",
      reason: "MalformedSignature",
    });
  });

  it("finds every signature in the document", () => {
    const document = documentOf(
      `<r><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/><a><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/></a></r>`,
    );

    expect(readSignatures(document)).toHaveLength(2);
  });
});

describe("outcomes the rest of the suite never reaches", () => {
  const validDocument = async () => {
    const draft = build({});
    const signature = readSignatures(draft)[0];
    if (signature === undefined) throw new Error("no signature in fixture");

    const digestValue = await buildReferenceDigest({
      element: draft.documentElement,
      omit: signature,
      algorithm: "SHA-256",
      inclusivePrefixes: new Set<string>(),
    });

    return build({ digestValue });
  };

  it("reports a signature it could check and accept", async () => {
    expect(await outcomeOf(await validDocument())).toEqual({
      kind: "Valid",
      referenceIds: ["_1"],
    });
  });

  it("reports a signature it could check and reject", async () => {
    const rejects = (): Promise<Result<boolean>> => Promise.resolve(ok(false));

    expect(await outcomeOf(await validDocument(), rejects)).toEqual({
      kind: "Invalid",
      reason: "SignatureMismatch",
    });
  });

  /**
   * A backend that cannot answer is not a verdict about the signature, so it
   * must not be reported as one.
   */
  it("separates a verifier that refused from a signature that failed", async () => {
    const refuses = (): Promise<Result<boolean>> =>
      Promise.resolve(err<boolean>("the backend did not answer"));

    expect(await outcomeOf(await validDocument(), refuses)).toEqual({
      kind: "VerifierRefused",
      message: "the backend did not answer",
    });
  });

  it("treats a signature with no algorithm as malformed, not unsupported", async () => {
    const document = documentOf(
      `<r ID="_1"><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
        `<ds:SignedInfo><ds:Reference URI="#_1"><ds:DigestValue>x</ds:DigestValue></ds:Reference></ds:SignedInfo>` +
        `<ds:SignatureValue>c2ln</ds:SignatureValue></ds:Signature></r>`,
    );

    expect(await outcomeOf(document)).toEqual({
      kind: "Unverifiable",
      reason: "MalformedSignature",
    });
  });
});

describe("signatures covering more than one element", () => {
  const twoReferencesXml = (
    firstDigest: string,
    secondDigest: string,
    second: string,
  ) =>
    `<r ID="_1"><a>x</a><b ID="_2">${second}</b>` +
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<ds:Reference URI="#_1"><ds:Transforms>` +
    `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `</ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue>${firstDigest}</ds:DigestValue></ds:Reference>` +
    `<ds:Reference URI="#_2"><ds:Transforms>` +
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `</ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue>${secondDigest}</ds:DigestValue></ds:Reference>` +
    `</ds:SignedInfo><ds:SignatureValue>c2ln</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${CERTIFICATE}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `</ds:Signature></r>`;

  const digestOf = async (xml: string, id: string, omitSignature: boolean) => {
    const document = documentOf(xml);
    const signature = readSignatures(document)[0];
    if (signature === undefined) throw new Error("no signature in fixture");

    const element = Array.from(document.getElementsByTagName("*")).find(
      (candidate) => candidate.getAttribute("ID") === id,
    );
    if (element === undefined) throw new Error(`no element carries ${id}`);

    return buildReferenceDigest({
      element,
      omit: omitSignature ? signature : undefined,
      algorithm: "SHA-256",
      inclusivePrefixes: new Set<string>(),
    });
  };

  const honest = async (second: string) => {
    const first = await digestOf(
      twoReferencesXml("PLACEHOLDER", "PLACEHOLDER", second),
      "_1",
      true,
    );
    const secondDigest = await digestOf(
      twoReferencesXml(first, "PLACEHOLDER", second),
      "_2",
      false,
    );
    return twoReferencesXml(first, secondDigest, second);
  };

  it("accepts a signature whose every reference matches, naming them all", async () => {
    const outcome = await outcomeOf(documentOf(await honest("bob")));

    expect(outcome).toStrictEqual({
      kind: "Valid",
      referenceIds: ["_1", "_2"],
    });
  });

  it("refuses when a later reference does not match, even though the first does", async () => {
    const honestXml = await honest("bob");
    const tampered = honestXml.replace(
      '<b ID="_2">bob</b>',
      '<b ID="_2">mallory</b>',
    );

    expect(await outcomeOf(documentOf(tampered))).toStrictEqual({
      kind: "Invalid",
      reason: "DigestMismatch",
    });
  });
});

describe("reference transforms", () => {
  it("refuses a transform this plugin does not implement rather than guessing", async () => {
    const outcome = await outcomeOf(
      build({
        transforms:
          `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
          `</ds:Transforms>`,
      }),
    );

    expect(outcome).toStrictEqual({
      kind: "Unsupported",
      uri: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    });
  });

  it("does not strip the signature when no enveloped transform is declared", async () => {
    const document = build({});
    const signature = readSignatures(document)[0];
    if (signature === undefined) throw new Error("no signature in fixture");

    const strippedDigest = await buildReferenceDigest({
      element: document.documentElement,
      omit: signature,
      algorithm: "SHA-256",
      inclusivePrefixes: new Set<string>(),
    });

    expect(
      await outcomeOf(build({ digestValue: strippedDigest })),
    ).toStrictEqual({ kind: "Valid", referenceIds: ["_1"] });

    expect(
      await outcomeOf(
        build({
          digestValue: strippedDigest,
          transforms: `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms>`,
        }),
      ),
    ).toStrictEqual({ kind: "Invalid", reason: "DigestMismatch" });
  });
});
