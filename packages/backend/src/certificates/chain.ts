import { forge } from "../runtime/forge";

import { formatName, isSelfSigned } from "./parse";
import { type StoredCertificate } from "./schema";

type Candidate = {
  id: string;
  certificate: forge.pki.Certificate;
  subject: string;
  issuer: string;
  isSelfSigned: boolean;
};

const readCandidate = (stored: StoredCertificate): Candidate | undefined => {
  try {
    const certificate = forge.pki.certificateFromPem(stored.certificatePem);
    const subject = formatName(certificate.subject.attributes);
    const issuer = formatName(certificate.issuer.attributes);

    return {
      id: stored.id,
      certificate,
      subject,
      issuer,
      isSelfSigned: isSelfSigned(certificate),
    };
  } catch {
    return undefined;
  }
};

export const linkParents = (
  certificates: StoredCertificate[],
): StoredCertificate[] => {
  const candidates = certificates.flatMap((stored) => {
    const candidate = readCandidate(stored);
    return candidate === undefined ? [] : [candidate];
  });

  const byId = new Map(candidates.map((entry) => [entry.id, entry]));

  const findParentId = (child: Candidate): string | undefined => {
    if (child.isSelfSigned) return undefined;

    for (const candidate of candidates) {
      if (candidate.id === child.id) continue;
      if (candidate.subject !== child.issuer) continue;

      const verified = (() => {
        try {
          return candidate.certificate.verify(child.certificate);
        } catch {
          return false;
        }
      })();

      if (verified) return candidate.id;
    }

    return undefined;
  };

  return certificates.map((stored) => {
    const child = byId.get(stored.id);
    if (child === undefined) return { ...stored, parentId: undefined };

    return { ...stored, parentId: findParentId(child) };
  });
};
