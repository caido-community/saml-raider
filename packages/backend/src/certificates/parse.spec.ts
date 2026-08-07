import { describe, expect, it } from "vitest";

import { forge } from "../runtime/forge";
import {
  EC_CERTIFICATE_PEM,
  EXPIRED_CERTIFICATE_PEM,
  FINGERPRINTS_SHA256,
  INTERMEDIATE_CERTIFICATE_PEM,
  LEAF_CERTIFICATE_PEM,
  LEAF_EXPECTED,
  LEAF_KEY_PEM,
  MALFORMED_CERTIFICATE_PEM,
  ROOT_CERTIFICATE_PEM,
  ROOT_KEY_PEM,
  UNKNOWN_EXTENSION_CERTIFICATE_PEM,
} from "../tests/fixtures";

import { parseCertificatePem } from "./parse";

const parseOk = (pem: string) => {
  const parsed = parseCertificatePem(pem);
  if (parsed.kind !== "Ok") {
    throw new Error(`expected a parseable fixture, received ${parsed.kind}`);
  }
  return parsed;
};

describe("fields openssl also reports", () => {
  const { details } = parseOk(LEAF_CERTIFICATE_PEM);

  it("reads the identity fields", () => {
    expect(details.version).toBe(LEAF_EXPECTED.version);
    expect(details.serialNumberHex).toBe(LEAF_EXPECTED.serialNumberHex);
    expect(details.subject).toBe(LEAF_EXPECTED.subject);
    expect(details.issuer).toBe(LEAF_EXPECTED.issuer);
    expect(details.signatureAlgorithm).toBe(LEAF_EXPECTED.signatureAlgorithm);
  });

  it("reads validity as an instant, not a locale string", () => {
    expect(details.notBefore).toBe(LEAF_EXPECTED.notBefore);
    expect(details.notAfter).toBe(LEAF_EXPECTED.notAfter);
  });

  it("reads the public key", () => {
    expect(details.keySizeBits).toBe(LEAF_EXPECTED.keySizeBits);
    expect(details.publicExponent).toBe(LEAF_EXPECTED.publicExponent);
    expect(details.modulusHex).toBe(LEAF_EXPECTED.modulusHex);
  });

  it("reads the extensions", () => {
    expect(details.basicConstraints?.isCertificateAuthority).toBe(false);
    expect(details.keyUsage).toEqual(LEAF_EXPECTED.keyUsage);
    expect(details.isKeyUsageCritical).toBe(LEAF_EXPECTED.isKeyUsageCritical);
    expect(details.extendedKeyUsage).toEqual(LEAF_EXPECTED.extendedKeyUsage);
    expect(details.subjectAlternativeNames).toEqual(
      LEAF_EXPECTED.subjectAlternativeNames,
    );
    expect(details.subjectKeyIdentifier).toBe(
      LEAF_EXPECTED.subjectKeyIdentifier,
    );
    expect(details.authorityKeyIdentifier).toBe(
      LEAF_EXPECTED.authorityKeyIdentifier,
    );
  });

  it("computes the fingerprint openssl computes", () => {
    expect(details.fingerprintSha256).toBe(FINGERPRINTS_SHA256.leaf);
  });

  it("does not mistake a leaf for self-signed", () => {
    expect(details.isSelfSigned).toBe(false);
  });
});

describe("certificate authorities", () => {
  it("reads the root path length", () => {
    const { details } = parseOk(ROOT_CERTIFICATE_PEM);

    expect(details.basicConstraints?.isCertificateAuthority).toBe(true);
    expect(details.basicConstraints?.pathLength).toBe(1);
    expect(details.isSelfSigned).toBe(true);
    expect(details.fingerprintSha256).toBe(FINGERPRINTS_SHA256.root);
  });

  it("reads an intermediate that may not issue further authorities", () => {
    const { details } = parseOk(INTERMEDIATE_CERTIFICATE_PEM);

    expect(details.basicConstraints?.pathLength).toBe(0);
    expect(details.isSelfSigned).toBe(false);
    expect(details.fingerprintSha256).toBe(FINGERPRINTS_SHA256.intermediate);
  });
});

describe("cases the UI has to render differently", () => {
  it("reports an expired certificate's real dates rather than failing", () => {
    const { details } = parseOk(EXPIRED_CERTIFICATE_PEM);

    expect(Date.parse(details.notAfter)).toBeLessThan(Date.now());
    expect(details.fingerprintSha256).toBe(FINGERPRINTS_SHA256.expired);
  });

  it("keeps an extension it does not model instead of dropping it", () => {
    const { details } = parseOk(UNKNOWN_EXTENSION_CERTIFICATE_PEM);
    const unknown = details.unsupportedExtensions.find(
      (extension) => extension.oid === "1.3.6.1.4.1.99999.1",
    );

    expect(unknown).toBeDefined();
    expect(unknown?.valueBase64.length).toBeGreaterThan(0);
  });
});

describe("inputs that must fail explicitly", () => {
  it("refuses a non-RSA certificate rather than reporting a zero key size", () => {
    expect(parseCertificatePem(EC_CERTIFICATE_PEM).kind).toBe("UnsupportedKey");
  });

  it("refuses base64 that is not a certificate", () => {
    expect(parseCertificatePem(MALFORMED_CERTIFICATE_PEM).kind).toBe(
      "Malformed",
    );
  });

  it("refuses input with no PEM block at all", () => {
    expect(parseCertificatePem("not a certificate").kind).toBe("Malformed");
  });
});

describe("the stored PEM", () => {
  it("re-encodes to the same bytes, so the fingerprint stays the id", () => {
    const first = parseOk(LEAF_CERTIFICATE_PEM);
    const second = parseOk(first.normalisedPem);

    expect(second.details.fingerprintSha256).toBe(
      first.details.fingerprintSha256,
    );
    expect(second.normalisedPem).toBe(first.normalisedPem);
  });
});

describe("self-signed means the signature verifies, not that the names match", () => {
  const selfIssuedButSignedByAnother = (): string => {
    const own = forge.pki.privateKeyFromPem(LEAF_KEY_PEM);
    const signer = forge.pki.privateKeyFromPem(ROOT_KEY_PEM);
    const name = [{ shortName: "CN", value: "same.example" }];

    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.setRsaPublicKey(own.n, own.e);
    certificate.serialNumber = "01";
    certificate.validity.notBefore = new Date("2026-01-01T00:00:00Z");
    certificate.validity.notAfter = new Date("2027-01-01T00:00:00Z");
    certificate.setSubject(name);
    certificate.setIssuer(name);
    certificate.sign(signer, forge.md.sha256.create());

    return forge.pki.certificateToPem(certificate);
  };

  it("rejects a certificate that only carries its own name", () => {
    const result = parseCertificatePem(selfIssuedButSignedByAnother());

    expect(result.kind).toBe("Ok");
    expect(result.kind === "Ok" && result.details.isSelfSigned).toBe(false);
  });
});
