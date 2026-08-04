import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it } from "vitest";

import {
  INTERMEDIATE_CERTIFICATE_PEM,
  INTERMEDIATE_KEY_PEM,
  LEAF_CERTIFICATE_PEM,
  LEAF_KEY_PEM,
  ROOT_CERTIFICATE_PEM,
} from "../tests/fixtures";

import {
  buildSerialNumber,
  cloneCertificate,
  createSelfSignedCertificate,
  type GeneratedCertificate,
} from "./generate";
import { parseCertificatePem } from "./parse";

const directory = mkdtempSync(join(tmpdir(), "saml-raider-"));

const openssl = (args: string[]): string => {
  const pinned = args[0] === "x509" ? [...args, "-nameopt", "RFC2253"] : args;
  return execFileSync("openssl", pinned, { encoding: "utf8" });
};

const writePem = (name: string, pem: string): string => {
  const path = join(directory, name);
  writeFileSync(path, pem);
  return path;
};

const expectCertificatePem = (result: GeneratedCertificate) => {
  if (result.kind !== "Ok") {
    throw new Error(`expected a certificate, got ${JSON.stringify(result)}`);
  }
  return result.certificatePem;
};

const SUBJECT = {
  commonName: "Generated Fixture",
  organization: "SAML Raider",
  country: "CH",
};

const VALIDITY = {
  notBefore: "2026-01-01T00:00:00.000Z",
  notAfter: "2027-01-01T00:00:00.000Z",
};

describe("self-signed certificates", () => {
  const pem = expectCertificatePem(
    createSelfSignedCertificate({
      privateKeyPem: LEAF_KEY_PEM,
      subject: SUBJECT,
      validity: VALIDITY,
      signatureAlgorithm: "SHA-256",
      isCertificateAuthority: true,
    }),
  );

  it("verifies against itself with openssl", () => {
    const path = writePem("selfsigned.pem", pem);
    expect(openssl(["verify", "-CAfile", path, path])).toContain("OK");
  });

  it("carries the subject and validity openssl reads back", () => {
    const path = writePem("selfsigned.pem", pem);
    const text = openssl(["x509", "-in", path, "-noout", "-text"]);

    expect(text).toContain("CN=Generated Fixture");
    expect(text).toContain("O=SAML Raider");
    expect(text).toContain("Not Before: Jan  1 00:00:00 2026 GMT");
    expect(text).toContain("Not After : Jan  1 00:00:00 2027 GMT");
    expect(text).toContain("sha256WithRSAEncryption");
    expect(text).toContain("CA:TRUE");
  });

  it("honours the requested digest", () => {
    const sha512 = expectCertificatePem(
      createSelfSignedCertificate({
        privateKeyPem: LEAF_KEY_PEM,
        subject: SUBJECT,
        validity: VALIDITY,
        signatureAlgorithm: "SHA-512",
        isCertificateAuthority: false,
      }),
    );
    const path = writePem("sha512.pem", sha512);

    expect(openssl(["x509", "-in", path, "-noout", "-text"])).toContain(
      "sha512WithRSAEncryption",
    );
  });

  it("refuses a key it cannot read instead of producing a certificate", () => {
    const result = createSelfSignedCertificate({
      privateKeyPem:
        "-----BEGIN PRIVATE KEY-----\nbm90YWtleQ==\n-----END PRIVATE KEY-----",
      subject: SUBJECT,
      validity: VALIDITY,
      signatureAlgorithm: "SHA-256",
      isCertificateAuthority: false,
    });

    expect(result.kind).toBe("Failed");
  });
});

describe("clones", () => {
  const pem = expectCertificatePem(
    cloneCertificate({
      sourceCertificatePem: LEAF_CERTIFICATE_PEM,
      privateKeyPem: LEAF_KEY_PEM,
      signatureAlgorithm: "SHA-256",
    }),
  );

  it("keeps the original subject and issuer names", () => {
    const path = writePem("clone.pem", pem);
    const subject = openssl(["x509", "-in", path, "-noout", "-subject"]);
    const issuer = openssl(["x509", "-in", path, "-noout", "-issuer"]);

    expect(subject).toContain("CN=idp.fixture.example");
    expect(issuer).toContain("CN=Fixture Intermediate CA");
  });

  it("copies the extensions that describe the certificate", () => {
    const path = writePem("clone.pem", pem);
    const text = openssl(["x509", "-in", path, "-noout", "-text"]);

    expect(text).toContain("DNS:idp.fixture.example");
    expect(text).toContain("TLS Web Server Authentication");
    expect(text).toContain("Digital Signature");
  });

  it("issues a new serial so the clone is not mistaken for the original", () => {
    const original = parseCertificatePem(LEAF_CERTIFICATE_PEM);
    const clone = parseCertificatePem(pem);
    if (original.kind !== "Ok" || clone.kind !== "Ok") {
      throw new Error("expected both certificates to parse");
    }

    expect(clone.details.serialNumberHex).not.toBe(
      original.details.serialNumberHex,
    );
    expect(clone.details.fingerprintSha256).not.toBe(
      original.details.fingerprintSha256,
    );
  });

  it("does not claim the original's key identifier", () => {
    const original = parseCertificatePem(LEAF_CERTIFICATE_PEM);
    const clone = parseCertificatePem(pem);
    if (original.kind !== "Ok" || clone.kind !== "Ok") {
      throw new Error("expected both certificates to parse");
    }

    expect(clone.details.subjectKeyIdentifier).toBeDefined();
    expect(clone.details.authorityKeyIdentifier).toBeUndefined();
  });

  it("leaves the source certificate untouched", () => {
    const reparsed = parseCertificatePem(LEAF_CERTIFICATE_PEM);
    if (reparsed.kind !== "Ok")
      throw new Error("expected the fixture to parse");

    expect(reparsed.details.serialNumberHex).toBe("2002");
  });
});

describe("clone chains", () => {
  it("re-signs a clone against its cloned parent so openssl accepts the chain", () => {
    const rootClone = expectCertificatePem(
      cloneCertificate({
        sourceCertificatePem: ROOT_CERTIFICATE_PEM,
        privateKeyPem: INTERMEDIATE_KEY_PEM,
        signatureAlgorithm: "SHA-256",
      }),
    );

    const intermediateClone = expectCertificatePem(
      cloneCertificate({
        sourceCertificatePem: INTERMEDIATE_CERTIFICATE_PEM,
        privateKeyPem: LEAF_KEY_PEM,
        signatureAlgorithm: "SHA-256",
        issuer: {
          certificatePem: rootClone,
          privateKeyPem: INTERMEDIATE_KEY_PEM,
        },
      }),
    );

    const rootPath = writePem("root-clone.pem", rootClone);
    const intermediatePath = writePem(
      "intermediate-clone.pem",
      intermediateClone,
    );

    expect(
      openssl(["verify", "-CAfile", rootPath, intermediatePath]),
    ).toContain("OK");
  });

  it("reports an unreadable parent rather than signing with the wrong key", () => {
    const result = cloneCertificate({
      sourceCertificatePem: LEAF_CERTIFICATE_PEM,
      privateKeyPem: LEAF_KEY_PEM,
      signatureAlgorithm: "SHA-256",
      issuer: {
        certificatePem: "not a certificate",
        privateKeyPem: LEAF_KEY_PEM,
      },
    });

    expect(result).toMatchObject({
      kind: "Failed",
      failure: { kind: "UnreadableCertificate" },
    });
  });
});

describe("serial numbers", () => {
  it("stays positive so it encodes as an unsigned integer", () => {
    expect(buildSerialNumber().startsWith("00")).toBe(true);
  });

  it("does not repeat", () => {
    const serials = new Set(
      Array.from({ length: 50 }, () => buildSerialNumber()),
    );

    expect(serials.size).toBe(50);
  });
});
