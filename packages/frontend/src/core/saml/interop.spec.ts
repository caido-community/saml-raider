// @vitest-environment jsdom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { ok } from "shared";
import { describe, expect, it } from "vitest";

import { buildSignedDocument, type SignSignedInfo } from "./sign";
import { type VerifySignedInfo } from "./verify";
import { parseXml } from "./xml";

import { buildCertificate } from "@/tests/certificateService";
import { LEAF_CERTIFICATE_DER_BASE64 } from "@/tests/fixtures";
import { decodeBase64, isAbsent } from "@/utils";

const SIGNING = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/signing",
);

const read = (name: string) => readFileSync(join(SIGNING, name), "utf8");

const UNSIGNED =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"' +
  ' xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1"' +
  ' IssueInstant="2026-01-01T00:00:00Z" Version="2.0">' +
  "<saml:Issuer>https://idp.example.com</saml:Issuer>" +
  '<saml:Assertion ID="_a1" IssueInstant="2026-01-01T00:00:00Z" Version="2.0">' +
  "<saml:Issuer>https://idp.example.com</saml:Issuer>" +
  "<saml:Subject><saml:NameID>alice@example.com</saml:NameID></saml:Subject>" +
  "</saml:Assertion></samlp:Response>";

const decode = (base64: string): Uint8Array => {
  const bytes = decodeBase64(base64.replace(/\s+/g, ""));
  if (isAbsent(bytes)) throw new Error("the fixture is not valid base64");
  return bytes;
};

const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

const toBase64 = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const signWithWebCrypto: SignSignedInfo = async (input) => {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decode(read("leaf-key.pkcs8.b64")),
    ALGORITHM,
    false,
    ["sign"],
  );

  return ok(
    toBase64(
      await crypto.subtle.sign(
        ALGORITHM.name,
        key,
        decode(input.signedInfoBase64),
      ),
    ),
  );
};

const verifyWithWebCrypto: VerifySignedInfo = async (input) => {
  const key = await crypto.subtle.importKey(
    "spki",
    decode(read("leaf-pubkey.spki.b64")),
    ALGORITHM,
    false,
    ["verify"],
  );

  return ok(
    await crypto.subtle.verify(
      ALGORITHM.name,
      key,
      decode(input.signatureBase64),
      decode(input.signedInfoBase64),
    ),
  );
};

const signUnsigned = async () => {
  const parsed = parseXml(UNSIGNED);
  if (parsed.kind !== "Ok") throw new Error("the fixture did not parse");

  return buildSignedDocument(
    {
      document: parsed.document,
      targetId: "_a1",
      certificate: buildCertificate("leaf", {
        certificatePem:
          "-----BEGIN CERTIFICATE-----\n" +
          LEAF_CERTIFICATE_DER_BASE64 +
          "\n-----END CERTIFICATE-----\n",
      }),
      signatureAlgorithm: "SHA-256",
      digestAlgorithm: "SHA-256",
    },
    signWithWebCrypto,
    verifyWithWebCrypto,
  );
};

describe("signatures this plugin generates", () => {
  it("reproduces the exact bytes an independent verifier accepted", async () => {
    const outcome = await signUnsigned();
    if (outcome.kind !== "Ok") throw new Error(JSON.stringify(outcome.failure));

    expect(outcome.xml).toBe(read("signed-by-us.xml"));
  });

  it("signs deterministically, so the golden stays meaningful", async () => {
    const first = await signUnsigned();
    const second = await signUnsigned();
    if (first.kind !== "Ok" || second.kind !== "Ok") {
      throw new Error("signing failed");
    }

    expect(first.xml).toBe(second.xml);
  });
});
