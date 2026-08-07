import {
  type Certificate,
  type CertificateDetails,
  err,
  ok,
  type Result,
} from "shared";

import { type CertificateService } from "@/services/certificates";

const DETAILS: CertificateDetails = {
  version: 3,
  serialNumberHex: "2002",
  signatureAlgorithm: "sha256WithRSAEncryption",
  issuer: "CN=Fixture Intermediate CA",
  subject: "CN=idp.fixture.example",
  notBefore: "2026-01-01T00:00:00.000Z",
  notAfter: "2028-01-01T00:00:00.000Z",
  publicKeyAlgorithm: "rsaEncryption",
  keySizeBits: 2048,
  modulusHex: "bb3c",
  publicExponent: 65537,
  signatureHex: "abcd",
  fingerprintSha1: "aa",
  fingerprintSha256: "bb",
  keyUsage: ["digitalSignature"],
  isKeyUsageCritical: true,
  extendedKeyUsage: [],
  subjectAlternativeNames: [],
  issuerAlternativeNames: [],
  unsupportedExtensions: [],
  isSelfSigned: false,
};

export const buildCertificate = (
  id: string,
  overrides: Partial<Certificate> = {},
): Certificate => ({
  id,
  label: `certificate ${id}`,
  source: "Imported",
  hasPrivateKey: false,
  createdAt: "2026-08-04T00:00:00.000Z",
  certificatePem: `-----BEGIN CERTIFICATE-----\n${id}\n-----END CERTIFICATE-----\n`,
  details: { ...DETAILS },
  ...overrides,
});

export type ServiceCalls = {
  readPrivateKeyPem: string[];
  importExtracted: string[];
  removed: string[];
  renamed: Array<{ id: string; label: string }>;
};

export const buildServiceDouble = (
  certificates: Certificate[],
  failWith?: string,
): { service: CertificateService; calls: ServiceCalls } => {
  const calls: ServiceCalls = {
    readPrivateKeyPem: [],
    importExtracted: [],
    removed: [],
    renamed: [],
  };

  const fail = <T>(): Result<T> | undefined =>
    failWith === undefined ? undefined : err<T>(failWith);

  const service: CertificateService = {
    list: () => Promise.resolve(fail<Certificate[]>() ?? ok(certificates)),
    importCertificates: () => Promise.resolve(fail() ?? ok([])),
    importExtractedCertificate: (pem) => {
      calls.importExtracted.push(pem);
      return Promise.resolve(fail() ?? ok([]));
    },
    importPrivateKey: () =>
      Promise.resolve(fail() ?? ok(buildCertificate("imported"))),
    rename: (id, label) => {
      calls.renamed.push({ id, label });
      return Promise.resolve(fail() ?? ok(buildCertificate(id)));
    },
    remove: (id) => {
      calls.removed.push(id);
      return Promise.resolve(fail() ?? ok(id));
    },
    createSelfSigned: () =>
      Promise.resolve(fail() ?? ok(buildCertificate("created"))),
    clone: () => Promise.resolve(fail() ?? ok(buildCertificate("clone"))),
    cloneChain: () => Promise.resolve(fail() ?? ok([])),
    exportBackup: () => Promise.resolve(fail() ?? ok("{}")),
    importBackup: () => Promise.resolve(fail() ?? ok([])),
    signSignedInfo: () => Promise.resolve(fail<string>() ?? ok("c2ln")),
    verifySignature: () => Promise.resolve(fail<boolean>() ?? ok(true)),
    readPrivateKeyPem: (id) => {
      calls.readPrivateKeyPem.push(id);
      return Promise.resolve(
        fail() ??
          ok("-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"),
      );
    },
  };

  return { service, calls };
};
