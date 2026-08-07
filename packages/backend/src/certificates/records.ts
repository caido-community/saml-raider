import { type Certificate, err, ok, type Result } from "shared";

import { forge } from "../runtime/forge";

import { parseCertificatePem } from "./parse";
import { type StoredCertificate } from "./schema";

export const buildCertificate = (
  stored: StoredCertificate,
  keyIds: Set<string>,
): Result<Certificate> => {
  const parsed = parseCertificatePem(stored.certificatePem);
  if (parsed.kind !== "Ok") {
    return err(
      `Stored certificate ${stored.label} could not be read back (${parsed.kind}).`,
    );
  }

  return ok({
    id: stored.id,
    label: stored.label,
    source: stored.source,
    parentId: stored.parentId,
    hasPrivateKey: keyIds.has(stored.id),
    createdAt: stored.createdAt,
    certificatePem: stored.certificatePem,
    details: parsed.details,
  });
};

export const readMatchingKey = (
  certificatePem: string,
  privateKeyPem: string,
): Result<string> => {
  const parsed = parseCertificatePem(certificatePem);
  if (parsed.kind !== "Ok") return err("The certificate could not be read.");

  try {
    const key = forge.pki.privateKeyFromPem(privateKeyPem);
    if (key.n.toString(16) !== parsed.details.modulusHex) {
      return err(
        "That private key does not belong to this certificate: the public moduli differ.",
      );
    }

    return key.e.toString(10) === String(parsed.details.publicExponent)
      ? ok(privateKeyPem)
      : err(
          "That private key does not belong to this certificate: the public exponents differ.",
        );
  } catch {
    return err("The private key could not be read.");
  }
};
