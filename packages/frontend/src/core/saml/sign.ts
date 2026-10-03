import { type Certificate, type Result, type SignatureAlgorithm } from "shared";

import {
  ENVELOPED_SIGNATURE_URI,
  EXCLUSIVE_C14N_URI,
  readDigestMethodUri,
  readSignatureMethodUri,
} from "./algorithms";
import { toCanonicalXml } from "./c14n";
import { SAML_ASSERTION_NS, XML_SIGNATURE_NS } from "./namespaces";
import {
  buildElementIdIndex,
  buildReferenceDigest,
  readElementById,
} from "./reference";
import {
  readSignatures,
  type VerificationOutcome,
  verifySignature,
  type VerifySignedInfo,
} from "./verify";
import { parseXml, serializeXml } from "./xml";

import { encodeBase64, isAbsent, type Maybe } from "@/utils";

export type SignSignedInfo = (input: {
  certificateId: string;
  signedInfoBase64: string;
  signatureAlgorithm: SignatureAlgorithm;
}) => Promise<Result<string>>;

type SignaturePlacement = "AfterIssuer" | "FirstChild";

type SignatureSummary = {
  referenceId: string;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: SignatureAlgorithm;
  placement: SignaturePlacement;
};

type SignFailure =
  | { kind: "ReferenceNotFound"; id: string }
  | { kind: "DuplicateId"; id: string; count: number }
  | { kind: "SigningRefused"; message: string }
  | { kind: "SelfVerificationFailed"; outcome: VerificationOutcome };

export type SignOutcome =
  | { kind: "Ok"; xml: string; summary: SignatureSummary }
  | { kind: "Failed"; failure: SignFailure };

export type SignRequest = {
  document: Document;
  targetId: string;
  certificate: Certificate;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: SignatureAlgorithm;
};

const readFreePrefix = (target: Element): string => {
  const taken = new Set<string>();
  let current: Maybe<Element> = target;
  while (!isAbsent(current)) {
    for (const attribute of Array.from(current.attributes)) {
      if (attribute.name === "xmlns") continue;
      if (attribute.name.startsWith("xmlns:")) {
        taken.add(attribute.name.slice("xmlns:".length));
      }
    }
    current = current.parentElement;
  }

  if (!taken.has("ds")) return "ds";

  let index = 1;
  while (taken.has(`ds${String(index)}`)) index += 1;
  return `ds${String(index)}`;
};

type SignatureNodes = {
  signature: Element;
  signedInfo: Element;
  digestValue: Element;
  signatureValue: Element;
};

const buildSignatureSkeleton = (input: {
  owner: Document;
  prefix: string;
  targetId: string;
  certificateBase64: string;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: SignatureAlgorithm;
}): SignatureNodes => {
  const create = (localName: string): Element =>
    input.owner.createElementNS(
      XML_SIGNATURE_NS,
      `${input.prefix}:${localName}`,
    );

  const signature = create("Signature");
  const signedInfo = create("SignedInfo");
  const canonicalization = create("CanonicalizationMethod");
  canonicalization.setAttribute("Algorithm", EXCLUSIVE_C14N_URI);
  const signatureMethod = create("SignatureMethod");
  signatureMethod.setAttribute(
    "Algorithm",
    readSignatureMethodUri(input.signatureAlgorithm),
  );

  const reference = create("Reference");
  reference.setAttribute("URI", `#${input.targetId}`);
  const transforms = create("Transforms");
  const enveloped = create("Transform");
  enveloped.setAttribute("Algorithm", ENVELOPED_SIGNATURE_URI);
  const exclusive = create("Transform");
  exclusive.setAttribute("Algorithm", EXCLUSIVE_C14N_URI);
  transforms.append(enveloped, exclusive);

  const digestMethod = create("DigestMethod");
  digestMethod.setAttribute(
    "Algorithm",
    readDigestMethodUri(input.digestAlgorithm),
  );
  reference.append(transforms, digestMethod);

  signedInfo.append(canonicalization, signatureMethod, reference);

  const keyInfo = create("KeyInfo");
  const x509Data = create("X509Data");
  const x509Certificate = create("X509Certificate");
  x509Certificate.textContent = input.certificateBase64;
  x509Data.append(x509Certificate);
  keyInfo.append(x509Data);

  const digestValue = create("DigestValue");
  reference.append(digestValue);

  const signatureValue = create("SignatureValue");
  signature.append(signedInfo, signatureValue, keyInfo);

  return { signature, signedInfo, digestValue, signatureValue };
};

const insertSignature = (
  target: Element,
  signature: Element,
): SignaturePlacement => {
  const issuer = Array.from(target.children).find(
    (child) =>
      child.namespaceURI === SAML_ASSERTION_NS && child.localName === "Issuer",
  );

  if (isAbsent(issuer)) {
    target.insertBefore(signature, target.firstChild);
    return "FirstChild";
  }

  target.insertBefore(signature, issuer.nextSibling);
  return "AfterIssuer";
};

const readCertificateBase64 = (certificatePem: string): string =>
  certificatePem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");

export const buildSignedDocument = async (
  request: SignRequest,
  sign: SignSignedInfo,
  verify: VerifySignedInfo,
): Promise<SignOutcome> => {
  const clone = request.document.cloneNode(true) as Document;
  const found = readElementById(buildElementIdIndex(clone), request.targetId);

  if (found.kind === "Ambiguous") {
    return {
      kind: "Failed",
      failure: {
        kind: "DuplicateId",
        id: request.targetId,
        count: found.count,
      },
    };
  }
  if (found.kind === "Missing") {
    return {
      kind: "Failed",
      failure: { kind: "ReferenceNotFound", id: request.targetId },
    };
  }

  const nodes = buildSignatureSkeleton({
    owner: clone,
    prefix: readFreePrefix(found.element),
    targetId: request.targetId,
    certificateBase64: readCertificateBase64(
      request.certificate.certificatePem,
    ),
    signatureAlgorithm: request.signatureAlgorithm,
    digestAlgorithm: request.digestAlgorithm,
  });
  const placement = insertSignature(found.element, nodes.signature);
  const position = readSignatures(clone).indexOf(nodes.signature);

  nodes.digestValue.textContent = await buildReferenceDigest({
    element: found.element,
    omit: nodes.signature,
    algorithm: request.digestAlgorithm,
    inclusivePrefixes: new Set<string>(),
  });

  const canonical = toCanonicalXml(nodes.signedInfo, {
    withComments: false,
    inclusivePrefixes: new Set<string>(),
  });

  const signed = await sign({
    certificateId: request.certificate.id,
    signedInfoBase64: encodeBase64(new TextEncoder().encode(canonical)),
    signatureAlgorithm: request.signatureAlgorithm,
  });

  if (signed.kind === "Error") {
    return {
      kind: "Failed",
      failure: { kind: "SigningRefused", message: signed.error },
    };
  }

  nodes.signatureValue.textContent = signed.value;

  const xml = serializeXml(clone);
  const reparsed = parseXml(xml);
  if (reparsed.kind !== "Ok") {
    return {
      kind: "Failed",
      failure: {
        kind: "SelfVerificationFailed",
        outcome: { kind: "Unverifiable", reason: "MalformedSignature" },
      },
    };
  }

  const written = readSignatures(reparsed.document)[position];
  if (isAbsent(written)) {
    return {
      kind: "Failed",
      failure: {
        kind: "SelfVerificationFailed",
        outcome: { kind: "Unverifiable", reason: "MalformedSignature" },
      },
    };
  }

  const outcome = await verifySignature(written, verify);
  if (outcome.kind !== "Valid") {
    return {
      kind: "Failed",
      failure: { kind: "SelfVerificationFailed", outcome },
    };
  }

  return {
    kind: "Ok",
    xml,
    summary: {
      referenceId: request.targetId,
      signatureAlgorithm: request.signatureAlgorithm,
      digestAlgorithm: request.digestAlgorithm,
      placement,
    },
  };
};
