import { type Certificate, type SignatureAlgorithm } from "shared";

import { readDigestAlgorithm, readSignatureAlgorithm } from "./algorithms";
import { SAML_ASSERTION_NS, SAML_PROTOCOL_NS } from "./namespaces";
import { buildDocumentWithoutAnySignature } from "./remove";
import {
  buildSignedDocument,
  type SignOutcome,
  type SignSignedInfo,
} from "./sign";
import { type VerifySignedInfo } from "./verify";
import { parseXml, readAllElements, serializeXml } from "./xml";

import { isAbsent, type Maybe } from "@/utils";

export type ResignTarget = "Assertion" | "Message";

export type ResignPolicy = {
  certificate: Certificate;
  signatureAlgorithm: Maybe<SignatureAlgorithm>;
  digestAlgorithm: Maybe<SignatureAlgorithm>;
  isRemovingExistingSignatures: boolean;
};

export type ResignFailure =
  | { kind: "NoTargets" }
  | { kind: "MissingId"; localName: string }
  | { kind: "InheritedAlgorithmUnsupported"; uri: string }
  | { kind: "Unparseable" }
  | { kind: "SignFailed"; id: string; outcome: SignOutcome };

export type ResignOutcome =
  | { kind: "Ok"; xml: string; signedIds: string[] }
  | { kind: "Failed"; failure: ResignFailure };

const TARGETS: Record<ResignTarget, { namespace: string; localName: string }> =
  {
    Assertion: { namespace: SAML_ASSERTION_NS, localName: "Assertion" },
    Message: { namespace: SAML_PROTOCOL_NS, localName: "Response" },
  };

const readTargets = (document: Document, target: ResignTarget): Element[] => {
  const shape = TARGETS[target];
  return readAllElements(document).filter(
    (element) =>
      element.namespaceURI === shape.namespace &&
      element.localName === shape.localName,
  );
};

type InheritedAlgorithms = {
  signature: Maybe<SignatureAlgorithm>;
  digest: Maybe<SignatureAlgorithm>;
  signatureUri: string;
};

const readInheritedAlgorithms = (document: Document): InheritedAlgorithms => {
  const elements = readAllElements(document);
  const signatureUri =
    elements
      .find((element) => element.localName === "SignatureMethod")
      ?.getAttribute("Algorithm") ?? "";
  const digestUri =
    elements
      .find((element) => element.localName === "DigestMethod")
      ?.getAttribute("Algorithm") ?? "";

  return {
    signature: readSignatureAlgorithm(signatureUri),
    digest: readDigestAlgorithm(digestUri),
    signatureUri,
  };
};

export const buildResignedDocument = async (input: {
  document: Document;
  target: ResignTarget;
  policy: ResignPolicy;
  sign: SignSignedInfo;
  verify: VerifySignedInfo;
}): Promise<ResignOutcome> => {
  const targetIds = readTargets(input.document, input.target).map((element) =>
    element.getAttribute("ID"),
  );
  if (targetIds.length === 0) {
    return { kind: "Failed", failure: { kind: "NoTargets" } };
  }
  if (targetIds.some(isAbsent)) {
    return {
      kind: "Failed",
      failure: {
        kind: "MissingId",
        localName: TARGETS[input.target].localName,
      },
    };
  }

  const inherited = readInheritedAlgorithms(input.document);
  const signatureAlgorithm =
    input.policy.signatureAlgorithm ?? inherited.signature;
  const digestAlgorithm = input.policy.digestAlgorithm ?? inherited.digest;

  if (isAbsent(signatureAlgorithm) || isAbsent(digestAlgorithm)) {
    return {
      kind: "Failed",
      failure: {
        kind: "InheritedAlgorithmUnsupported",
        uri: inherited.signatureUri,
      },
    };
  }

  let xml = input.policy.isRemovingExistingSignatures
    ? buildDocumentWithoutAnySignature(input.document)
    : serializeXml(input.document);

  const signedIds: string[] = [];

  for (const id of targetIds) {
    if (isAbsent(id)) continue;

    const parsed = parseXml(xml);
    if (parsed.kind !== "Ok") {
      return { kind: "Failed", failure: { kind: "Unparseable" } };
    }

    const outcome = await buildSignedDocument(
      {
        document: parsed.document,
        targetId: id,
        certificate: input.policy.certificate,
        signatureAlgorithm,
        digestAlgorithm,
      },
      input.sign,
      input.verify,
    );

    if (outcome.kind !== "Ok") {
      return { kind: "Failed", failure: { kind: "SignFailed", id, outcome } };
    }

    xml = outcome.xml;
    signedIds.push(id);
  }

  return { kind: "Ok", xml, signedIds };
};

export const describeResignFailure = (failure: ResignFailure): string => {
  switch (failure.kind) {
    case "NoTargets":
      return "this message has nothing to sign at that level";

    case "MissingId":
      return `the ${failure.localName} has no ID attribute, so a signature could not reference it`;

    case "InheritedAlgorithmUnsupported":
      return `this message was signed with ${failure.uri}, which this plugin does not implement`;

    case "Unparseable":
      return "the re-signed message could not be read back, so it was discarded";

    case "SignFailed":
      return `signing ${failure.id} failed, so nothing was changed`;
  }
};
