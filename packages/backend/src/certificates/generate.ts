import { randomBytes } from "crypto";

import {
  type CertificateSubject,
  type CertificateValidity,
  readErrorMessage,
  type SignatureAlgorithm,
} from "shared";

import { forge } from "../runtime/forge";

type GenerateFailure =
  | { kind: "UnreadableKey"; message: string }
  | { kind: "UnreadableCertificate"; message: string };

export type GeneratedCertificate =
  | { kind: "Ok"; certificatePem: string }
  | { kind: "Failed"; failure: GenerateFailure };

const REGENERATED_EXTENSIONS = new Set([
  "subjectKeyIdentifier",
  "authorityKeyIdentifier",
]);

export const DIGESTS: Record<SignatureAlgorithm, () => forge.md.MessageDigest> =
  {
    "SHA-256": forge.md.sha256.create,
    "SHA-384": forge.md.sha384.create,
    "SHA-512": forge.md.sha512.create,
    "SHA-1": forge.md.sha1.create,
  };

export const buildSerialNumber = (): string =>
  `00${Buffer.from(randomBytes(16)).toString("hex")}`;

const buildSubjectFields = (
  subject: CertificateSubject,
): forge.pki.CertificateField[] => {
  const fields: forge.pki.CertificateField[] = [
    { name: "commonName", value: subject.commonName },
  ];

  const optional: ReadonlyArray<[string, string | undefined]> = [
    ["organizationName", subject.organization],
    ["organizationalUnitName", subject.organizationalUnit],
    ["countryName", subject.country],
    ["stateOrProvinceName", subject.state],
    ["localityName", subject.locality],
  ];

  for (const [name, value] of optional) {
    if (value !== undefined && value !== "") fields.push({ name, value });
  }

  return fields;
};

type Read<T> =
  | { kind: "Ok"; value: T }
  | { kind: "Failed"; failure: GenerateFailure };

export const readPrivateKey = (pem: string): Read<forge.pki.rsa.PrivateKey> => {
  try {
    return { kind: "Ok", value: forge.pki.privateKeyFromPem(pem) };
  } catch (error) {
    return {
      kind: "Failed",
      failure: { kind: "UnreadableKey", message: readErrorMessage(error) },
    };
  }
};

export const readCertificate = (pem: string): Read<forge.pki.Certificate> => {
  try {
    return { kind: "Ok", value: forge.pki.certificateFromPem(pem) };
  } catch (error) {
    return {
      kind: "Failed",
      failure: {
        kind: "UnreadableCertificate",
        message: readErrorMessage(error),
      },
    };
  }
};

const signCertificate = (
  certificate: forge.pki.Certificate,
  signingKey: forge.pki.rsa.PrivateKey,
  algorithm: SignatureAlgorithm,
): GeneratedCertificate => {
  certificate.sign(signingKey, DIGESTS[algorithm]());
  return {
    kind: "Ok",
    certificatePem: forge.pki.certificateToPem(certificate),
  };
};

export const createSelfSignedCertificate = (input: {
  privateKeyPem: string;
  subject: CertificateSubject;
  validity: CertificateValidity;
  signatureAlgorithm: SignatureAlgorithm;
  isCertificateAuthority: boolean;
}): GeneratedCertificate => {
  const key = readPrivateKey(input.privateKeyPem);
  if (key.kind === "Failed") return key;

  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.setRsaPublicKey(key.value.n, key.value.e);
  certificate.serialNumber = buildSerialNumber();
  certificate.validity.notBefore = new Date(input.validity.notBefore);
  certificate.validity.notAfter = new Date(input.validity.notAfter);

  const fields = buildSubjectFields(input.subject);
  certificate.setSubject(fields);
  certificate.setIssuer(fields);
  certificate.setExtensions([
    { name: "basicConstraints", cA: input.isCertificateAuthority },
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      keyEncipherment: !input.isCertificateAuthority,
      keyCertSign: input.isCertificateAuthority,
      cRLSign: input.isCertificateAuthority,
    },
    { name: "subjectKeyIdentifier" },
  ]);

  return signCertificate(certificate, key.value, input.signatureAlgorithm);
};

export const cloneCertificate = (input: {
  sourceCertificatePem: string;
  privateKeyPem: string;
  signatureAlgorithm: SignatureAlgorithm;
  issuer?: { certificatePem: string; privateKeyPem: string };
}): GeneratedCertificate => {
  const source = readCertificate(input.sourceCertificatePem);
  if (source.kind === "Failed") return source;

  const key = readPrivateKey(input.privateKeyPem);
  if (key.kind === "Failed") return key;

  const clone = forge.pki.createCertificate();
  clone.publicKey = forge.pki.setRsaPublicKey(key.value.n, key.value.e);
  clone.serialNumber = buildSerialNumber();
  clone.validity.notBefore = source.value.validity.notBefore;
  clone.validity.notAfter = source.value.validity.notAfter;
  clone.setSubject(source.value.subject.attributes);

  const copied = source.value.extensions.filter(
    (extension: { name?: string }) =>
      !REGENERATED_EXTENSIONS.has(extension.name ?? ""),
  );

  if (input.issuer === undefined) {
    clone.setIssuer(source.value.issuer.attributes);
    clone.setExtensions([...copied, { name: "subjectKeyIdentifier" }]);
    return signCertificate(clone, key.value, input.signatureAlgorithm);
  }

  const issuerCertificate = readCertificate(input.issuer.certificatePem);
  if (issuerCertificate.kind === "Failed") return issuerCertificate;

  const issuerKey = readPrivateKey(input.issuer.privateKeyPem);
  if (issuerKey.kind === "Failed") return issuerKey;

  clone.setIssuer(issuerCertificate.value.subject.attributes);
  clone.setExtensions([...copied, { name: "subjectKeyIdentifier" }]);

  return signCertificate(clone, issuerKey.value, input.signatureAlgorithm);
};
