// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { ok } from "shared";
import { describe, expect, it } from "vitest";

import { toCanonicalXml } from "./c14n";
import { buildReferenceDigest } from "./reference";
import {
  readSignatures,
  verifySignature,
  type VerifySignedInfo,
} from "./verify";
import { parseXml } from "./xml";

import { decodeBase64, isAbsent } from "@/utils";

const CAPTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/captures",
);

const read = (name: string) => readFileSync(join(CAPTURES, name), "utf8");

const CAPTURE = read("samltest-shibboleth.xml");

const EXCLUSIVE = { withComments: false, inclusivePrefixes: new Set<string>() };

const decode = (base64: string): Uint8Array => {
  const bytes = decodeBase64(base64.replace(/\s+/g, ""));
  if (isAbsent(bytes)) throw new Error("the fixture is not valid base64");
  return bytes;
};

const verifyWithWebCrypto: VerifySignedInfo = async (input) => {
  const key = await crypto.subtle.importKey(
    "spki",
    decode(read("samltest-shibboleth.pubkey.spki.b64")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return ok(
    await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(input.signatureBase64),
      decode(input.signedInfoBase64),
    ),
  );
};

const parse = (xml: string) => {
  const parsed = parseXml(xml);
  if (parsed.kind !== "Ok") throw new Error("the capture did not parse");
  return parsed.document;
};

const readSignature = (document: Document) => {
  const signature = readSignatures(document)[0];
  if (signature === undefined)
    throw new Error("the capture carries no signature");
  return signature;
};

describe("a real signed message from samltest.dev", () => {
  it("canonicalizes the signed assertion exactly as libxml2 does", () => {
    const document = parse(CAPTURE);
    const signature = readSignature(document);
    const assertion = signature.parentElement;
    if (assertion === null) throw new Error("the signature has no parent");

    expect(toCanonicalXml(assertion, { ...EXCLUSIVE, omit: signature })).toBe(
      read("samltest-shibboleth.assertion.exc"),
    );
  });

  it("canonicalizes SignedInfo exactly as libxml2 does", () => {
    const document = parse(CAPTURE);
    const signedInfo = readSignature(document).getElementsByTagNameNS(
      "http://www.w3.org/2000/09/xmldsig#",
      "SignedInfo",
    )[0];
    if (signedInfo === undefined) throw new Error("no SignedInfo");

    expect(toCanonicalXml(signedInfo, { ...EXCLUSIVE, omit: undefined })).toBe(
      read("samltest-shibboleth.signedinfo.exc"),
    );
  });

  it("reproduces the digest the identity provider published", async () => {
    const document = parse(CAPTURE);
    const signature = readSignature(document);
    const assertion = signature.parentElement;
    if (assertion === null) throw new Error("the signature has no parent");

    const digest = await buildReferenceDigest({
      element: assertion,
      omit: signature,
      algorithm: "SHA-256",
      inclusivePrefixes: new Set<string>(),
    });

    expect(digest).toBe("d0q6Oq8fsBlfDyW9Dk/wptsIp2rtj59lQ5r/C4+FPCI=");
  });

  it("verifies end to end against the certificate the message carries", async () => {
    const signature = readSignature(parse(CAPTURE));

    expect(await verifySignature(signature, verifyWithWebCrypto)).toEqual({
      kind: "Valid",
      referenceIds: ["66aa4dd5-1790-44c7-9981-5dd9314ef55c"],
    });
  });

  it("rejects the message when a single attribute value is tampered with", async () => {
    const tampered = CAPTURE.replace(
      "john.doe@example.com",
      "admin@example.com",
    );
    const signature = readSignature(parse(tampered));

    expect(await verifySignature(signature, verifyWithWebCrypto)).toEqual({
      kind: "Invalid",
      reason: "DigestMismatch",
    });
  });

  it("rejects the message when the signature bytes are tampered with", async () => {
    const tampered = CAPTURE.replace("fUGXu022", "FUGXu022");
    const signature = readSignature(parse(tampered));

    expect(await verifySignature(signature, verifyWithWebCrypto)).toEqual({
      kind: "Invalid",
      reason: "SignatureMismatch",
    });
  });
});
