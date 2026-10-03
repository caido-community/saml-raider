import { createHash } from "crypto";

import {
  type BasicConstraints,
  buildPem,
  type CertificateDetails,
  readErrorMessage,
  type UnsupportedExtension,
} from "shared";

import { forge } from "../runtime/forge";

import { readCertificateBlocks, readDerBytes } from "./pem";

export type ParsedCertificate =
  | { kind: "Ok"; details: CertificateDetails; normalisedPem: string }
  | { kind: "Malformed"; message: string }
  | { kind: "UnsupportedKey"; algorithm: string };

const KEY_USAGE_FLAGS = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly",
] as const;

const EXTENDED_KEY_USAGE_FLAGS = [
  "serverAuth",
  "clientAuth",
  "codeSigning",
  "emailProtection",
  "timeStamping",
] as const;

const MODELLED_EXTENSIONS = new Set([
  "basicConstraints",
  "keyUsage",
  "extKeyUsage",
  "subjectAltName",
  "issuerAltName",
  "subjectKeyIdentifier",
  "authorityKeyIdentifier",
]);

const ALTERNATIVE_NAME_KINDS: Record<number, string> = {
  1: "email",
  2: "DNS",
  6: "URI",
  7: "IP",
};

type ForgeExtension = Record<string, unknown> & {
  id: string;
  name?: string;
  critical?: boolean;
  value?: string;
};

export const formatName = (attributes: forge.pki.CertificateField[]): string =>
  attributes
    .map((attribute) => {
      const name = attribute.shortName ?? attribute.name ?? attribute.type;
      return `${String(name)}=${String(attribute.value)}`;
    })
    .join(", ");

export const isSelfSigned = (certificate: forge.pki.Certificate): boolean => {
  if (
    formatName(certificate.issuer.attributes) !==
    formatName(certificate.subject.attributes)
  ) {
    return false;
  }

  try {
    return certificate.verify(certificate);
  } catch {
    return false;
  }
};

const toBytes = (binary: string): Uint8Array =>
  Uint8Array.from(binary, (character) => character.charCodeAt(0) & 0xff);

const toHex = (binary: string): string =>
  Array.from(toBytes(binary), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const toBase64 = (binary: string): string =>
  Buffer.from(toBytes(binary)).toString("base64");

const digestHex = (algorithm: string, der: Uint8Array): string =>
  createHash(algorithm).update(der).digest("hex");

const readFlags = (
  extension: ForgeExtension,
  flags: ReadonlyArray<string>,
): string[] => flags.filter((flag) => extension[flag] === true);

const readAlternativeNames = (extension?: ForgeExtension): string[] => {
  const names = extension?.altNames;
  if (!Array.isArray(names)) return [];

  return names.map((entry: { type?: number; value?: string; ip?: string }) => {
    const kind = ALTERNATIVE_NAME_KINDS[entry.type ?? -1] ?? "other";
    return `${kind}:${entry.ip ?? entry.value ?? ""}`;
  });
};

const readBasicConstraints = (
  extension?: ForgeExtension,
): BasicConstraints | undefined => {
  if (extension === undefined) return undefined;

  const pathLength = extension.pathLenConstraint;
  return {
    isCertificateAuthority: extension.cA === true,
    pathLength: typeof pathLength === "number" ? pathLength : undefined,
    isCritical: extension.critical === true,
  };
};

const readSubjectKeyIdentifier = (
  extension?: ForgeExtension,
): string | undefined => {
  const identifier = extension?.subjectKeyIdentifier;
  return typeof identifier === "string" ? identifier.toLowerCase() : undefined;
};

const readAuthorityKeyIdentifier = (
  extension?: ForgeExtension,
): string | undefined => {
  const value = extension?.value;
  if (typeof value !== "string") return undefined;

  try {
    const sequence = forge.asn1.fromDer(value);
    if (!Array.isArray(sequence.value)) return undefined;

    const identifier = sequence.value.find(
      (member: forge.asn1.Asn1) =>
        member.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
        member.type === 0,
    );

    return typeof identifier?.value === "string"
      ? toHex(identifier.value)
      : undefined;
  } catch {
    return undefined;
  }
};

const readUnsupportedExtensions = (
  extensions: ForgeExtension[],
): UnsupportedExtension[] =>
  extensions
    .filter((extension) => !MODELLED_EXTENSIONS.has(extension.name ?? ""))
    .map((extension) => ({
      oid: extension.id,
      isCritical: extension.critical === true,
      valueBase64: toBase64(extension.value ?? ""),
    }));

const findExtension = (
  extensions: ForgeExtension[],
  name: string,
): ForgeExtension | undefined =>
  extensions.find((extension) => extension.name === name);

export const parseCertificatePem = (pem: string): ParsedCertificate => {
  const block = readCertificateBlocks(pem)[0];
  if (block === undefined) {
    return { kind: "Malformed", message: "no CERTIFICATE block was found" };
  }

  const certificate = (() => {
    try {
      return forge.pki.certificateFromPem(pem);
    } catch (error) {
      return readErrorMessage(error);
    }
  })();

  if (typeof certificate === "string") {
    return certificate.includes("OID is not RSA")
      ? { kind: "UnsupportedKey", algorithm: certificate }
      : { kind: "Malformed", message: certificate };
  }

  const publicKey = certificate.publicKey as Partial<forge.pki.rsa.PublicKey>;
  if (publicKey.n === undefined || publicKey.e === undefined) {
    return { kind: "UnsupportedKey", algorithm: "not an RSA public key" };
  }

  const der = readDerBytes(block);
  const extensions = certificate.extensions as ForgeExtension[];
  const keyUsage = findExtension(extensions, "keyUsage");

  const issuer = formatName(certificate.issuer.attributes);
  const subject = formatName(certificate.subject.attributes);

  const details: CertificateDetails = {
    version: certificate.version + 1,
    serialNumberHex: certificate.serialNumber.replace(/^00/, ""),
    signatureAlgorithm:
      forge.pki.oids[certificate.signatureOid] ?? certificate.signatureOid,
    issuer,
    subject,
    notBefore: certificate.validity.notBefore.toISOString(),
    notAfter: certificate.validity.notAfter.toISOString(),
    publicKeyAlgorithm: "rsaEncryption",
    keySizeBits: publicKey.n.bitLength(),
    modulusHex: publicKey.n.toString(16),
    publicExponent: Number(publicKey.e.toString(10)),
    signatureHex: toHex(certificate.signature),
    fingerprintSha1: digestHex("sha1", der),
    fingerprintSha256: digestHex("sha256", der),
    basicConstraints: readBasicConstraints(
      findExtension(extensions, "basicConstraints"),
    ),
    keyUsage:
      keyUsage === undefined ? [] : readFlags(keyUsage, KEY_USAGE_FLAGS),
    isKeyUsageCritical: keyUsage?.critical === true,
    extendedKeyUsage: (() => {
      const extended = findExtension(extensions, "extKeyUsage");
      return extended === undefined
        ? []
        : readFlags(extended, EXTENDED_KEY_USAGE_FLAGS);
    })(),
    subjectAlternativeNames: readAlternativeNames(
      findExtension(extensions, "subjectAltName"),
    ),
    issuerAlternativeNames: readAlternativeNames(
      findExtension(extensions, "issuerAltName"),
    ),
    subjectKeyIdentifier: readSubjectKeyIdentifier(
      findExtension(extensions, "subjectKeyIdentifier"),
    ),
    authorityKeyIdentifier: readAuthorityKeyIdentifier(
      findExtension(extensions, "authorityKeyIdentifier"),
    ),
    unsupportedExtensions: readUnsupportedExtensions(extensions),
    isSelfSigned: isSelfSigned(certificate),
  };

  return {
    kind: "Ok",
    details,
    normalisedPem: buildPem("CERTIFICATE", block.body),
  };
};
