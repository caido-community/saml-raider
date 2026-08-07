import { buildPem, type Result, type SignatureAlgorithm } from "shared";

import {
  ENVELOPED_SIGNATURE_URI,
  readCanonicalization,
  readDigestAlgorithm,
  readSignatureAlgorithm,
} from "./algorithms";
import { toCanonicalXml } from "./c14n";
import { XML_SIGNATURE_NS } from "./namespaces";
import {
  buildElementIdIndex,
  buildReferenceDigest,
  readElementById,
  readInclusivePrefixes,
  readReferenceId,
} from "./reference";

import { encodeBase64, isAbsent, type Maybe } from "@/utils";

export type VerifySignedInfo = (input: {
  certificatePem: string;
  signedInfoBase64: string;
  signatureBase64: string;
  signatureAlgorithm: SignatureAlgorithm;
}) => Promise<Result<boolean>>;

export type UnverifiableReason =
  | "MalformedSignature"
  | "NoCertificate"
  | "ReferenceAmbiguous"
  | "ReferenceMissing";

export type VerificationOutcome =
  | { kind: "Valid"; referenceIds: string[] }
  | { kind: "Invalid"; reason: "DigestMismatch" | "SignatureMismatch" }
  | { kind: "Unverifiable"; reason: UnverifiableReason }
  | { kind: "VerifierRefused"; message: string }
  | { kind: "Unsupported"; uri: string };

export const readSignatures = (root: Document | Element): Element[] =>
  Array.from(root.getElementsByTagNameNS(XML_SIGNATURE_NS, "Signature"));

const readOwningSignature = (element: Element): Maybe<Element> => {
  let current: Maybe<Element> = element.parentElement;
  while (!isAbsent(current)) {
    if (
      current.namespaceURI === XML_SIGNATURE_NS &&
      current.localName === "Signature"
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return undefined;
};

const readChild = (
  scope: Element,
  localName: string,
  owner: Element,
): Maybe<Element> =>
  Array.from(scope.getElementsByTagNameNS(XML_SIGNATURE_NS, localName)).find(
    (element) => readOwningSignature(element) === owner,
  );

const readChildren = (
  scope: Element,
  localName: string,
  owner: Element,
): Element[] =>
  Array.from(scope.getElementsByTagNameNS(XML_SIGNATURE_NS, localName)).filter(
    (element) => readOwningSignature(element) === owner,
  );

const readAlgorithmAttribute = (
  scope: Element,
  localName: string,
  owner: Element,
): Maybe<string> => {
  const element = readChild(scope, localName, owner);
  if (isAbsent(element)) return undefined;

  const uri = element.getAttribute("Algorithm");
  return isAbsent(uri) ? undefined : uri;
};

const readCertificatePem = (signature: Element): Maybe<string> => {
  const node = readChild(signature, "X509Certificate", signature);
  const body = node?.textContent?.replace(/\s+/g, "");
  if (isAbsent(body) || body === "") return undefined;

  return buildPem("CERTIFICATE", body);
};

export const verifySignature = async (
  signature: Element,
  verify: VerifySignedInfo,
): Promise<VerificationOutcome> => {
  const signedInfo = readChild(signature, "SignedInfo", signature);
  const signatureValue = readChild(signature, "SignatureValue", signature);
  if (isAbsent(signedInfo) || isAbsent(signatureValue)) {
    return { kind: "Unverifiable", reason: "MalformedSignature" };
  }

  const canonicalizationUri = readAlgorithmAttribute(
    signedInfo,
    "CanonicalizationMethod",
    signature,
  );
  const signatureUri = readAlgorithmAttribute(
    signedInfo,
    "SignatureMethod",
    signature,
  );
  if (isAbsent(canonicalizationUri) || isAbsent(signatureUri)) {
    return { kind: "Unverifiable", reason: "MalformedSignature" };
  }

  const canonicalization = readCanonicalization(canonicalizationUri);
  if (isAbsent(canonicalization)) {
    return { kind: "Unsupported", uri: canonicalizationUri };
  }

  const signatureAlgorithm = readSignatureAlgorithm(signatureUri);
  if (isAbsent(signatureAlgorithm)) {
    return { kind: "Unsupported", uri: signatureUri };
  }

  const references = readChildren(signedInfo, "Reference", signature);
  if (references.length === 0) {
    return { kind: "Unverifiable", reason: "MalformedSignature" };
  }

  const index = buildElementIdIndex(signature.ownerDocument);
  const referenceIds: string[] = [];

  for (const reference of references) {
    const digestValue = readChild(reference, "DigestValue", signature);
    const digestUri = readAlgorithmAttribute(
      reference,
      "DigestMethod",
      signature,
    );
    if (isAbsent(digestValue) || isAbsent(digestUri)) {
      return { kind: "Unverifiable", reason: "MalformedSignature" };
    }

    const digestAlgorithm = readDigestAlgorithm(digestUri);
    if (isAbsent(digestAlgorithm)) {
      return { kind: "Unsupported", uri: digestUri };
    }

    const transforms = readChild(reference, "Transforms", signature);
    const applied = isAbsent(transforms)
      ? []
      : readChildren(transforms, "Transform", signature).map(
          (transform) => transform.getAttribute("Algorithm") ?? "",
        );

    for (const uri of applied) {
      if (uri === ENVELOPED_SIGNATURE_URI) continue;
      if (!isAbsent(readCanonicalization(uri))) continue;
      return { kind: "Unsupported", uri };
    }

    const referenceId = readReferenceId(reference.getAttribute("URI") ?? "");
    if (isAbsent(referenceId)) {
      return { kind: "Unverifiable", reason: "ReferenceMissing" };
    }

    const found = readElementById(index, referenceId);
    if (found.kind === "Ambiguous") {
      return { kind: "Unverifiable", reason: "ReferenceAmbiguous" };
    }
    if (found.kind === "Missing") {
      return { kind: "Unverifiable", reason: "ReferenceMissing" };
    }

    const digest = await buildReferenceDigest({
      element: found.element,
      omit: applied.includes(ENVELOPED_SIGNATURE_URI) ? signature : undefined,
      algorithm: digestAlgorithm,
      inclusivePrefixes: isAbsent(transforms)
        ? new Set<string>()
        : readInclusivePrefixes(transforms),
    });

    if (digest !== (digestValue.textContent ?? "").replace(/\s+/g, "")) {
      return { kind: "Invalid", reason: "DigestMismatch" };
    }

    referenceIds.push(referenceId);
  }

  const certificatePem = readCertificatePem(signature);
  if (isAbsent(certificatePem)) {
    return { kind: "Unverifiable", reason: "NoCertificate" };
  }

  const canonicalizationMethod = readChild(
    signedInfo,
    "CanonicalizationMethod",
    signature,
  );
  const canonical = toCanonicalXml(signedInfo, {
    withComments: canonicalization === "ExclusiveWithComments",
    inclusivePrefixes: isAbsent(canonicalizationMethod)
      ? new Set<string>()
      : readInclusivePrefixes(canonicalizationMethod),
    omit: undefined,
  });

  const verified = await verify({
    certificatePem,
    signedInfoBase64: encodeBase64(new TextEncoder().encode(canonical)),
    signatureBase64: (signatureValue.textContent ?? "").replace(/\s+/g, ""),
    signatureAlgorithm,
  });

  if (verified.kind === "Error") {
    return { kind: "VerifierRefused", message: verified.error };
  }

  return verified.value
    ? { kind: "Valid", referenceIds }
    : { kind: "Invalid", reason: "SignatureMismatch" };
};
