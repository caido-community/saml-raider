import {
  SAML_ASSERTION_NS,
  SAML_PROTOCOL_NS,
  XML_ENCRYPTION_NS,
  XML_SIGNATURE_NS,
} from "./namespaces";
import {
  type SamlMessageInfo,
  type SamlMessageKind,
  type SignedElement,
} from "./types";
import { readAllElements } from "./xml";

import { isPresent, type Maybe } from "@/utils";

const MESSAGE_KINDS: ReadonlyArray<SamlMessageKind> = [
  "Response",
  "AuthnRequest",
  "LogoutRequest",
  "LogoutResponse",
  "ArtifactResolve",
  "ArtifactResponse",
  "AttributeQuery",
];

const inNamespaceOrUnprefixed = (
  element: Element,
  namespace: string,
): boolean =>
  element.namespaceURI === namespace || element.namespaceURI === null;

const readAttribute = (element: Maybe<Element>, name: string): Maybe<string> =>
  element?.getAttribute(name) ?? undefined;

const readText = (element: Maybe<Element>): Maybe<string> =>
  element?.textContent?.trim();

const readMessageKind = (root: Element): SamlMessageKind => {
  if (!inNamespaceOrUnprefixed(root, SAML_PROTOCOL_NS)) return "Unknown";

  return MESSAGE_KINDS.find((kind) => kind === root.localName) ?? "Unknown";
};

type Collected = {
  issuer: Maybe<Element>;
  conditions: Maybe<Element>;
  nameId: Maybe<Element>;
  confirmationData: Maybe<Element>;
  signatureMethod: Maybe<Element>;
  digestMethod: Maybe<Element>;
  encryptionMethod: Maybe<Element>;
  certificates: string[];
  statusCode: Maybe<Element>;
  assertions: number;
  encryptedAssertions: number;
  signedElements: SignedElement[];
  ids: string[];
};

const collect = (document: Document): Collected => {
  const found: Collected = {
    issuer: undefined,
    conditions: undefined,
    nameId: undefined,
    confirmationData: undefined,
    signatureMethod: undefined,
    digestMethod: undefined,
    encryptionMethod: undefined,
    certificates: [],
    statusCode: undefined,
    assertions: 0,
    encryptedAssertions: 0,
    signedElements: [],
    ids: [],
  };

  for (const element of readAllElements(document)) {
    const id = element.getAttribute("ID");
    if (isPresent(id)) found.ids.push(id);

    const name = element.localName;

    if (inNamespaceOrUnprefixed(element, SAML_ASSERTION_NS)) {
      if (name === "Assertion") found.assertions += 1;
      if (name === "EncryptedAssertion") found.encryptedAssertions += 1;
      if (name === "Issuer") found.issuer ??= element;
      if (name === "Conditions") found.conditions ??= element;
      if (name === "NameID") found.nameId ??= element;
      if (name === "SubjectConfirmationData")
        found.confirmationData ??= element;
    }

    if (
      inNamespaceOrUnprefixed(element, SAML_PROTOCOL_NS) &&
      name === "StatusCode"
    ) {
      found.statusCode ??= element;
    }

    if (inNamespaceOrUnprefixed(element, XML_SIGNATURE_NS)) {
      if (name === "SignatureMethod") found.signatureMethod ??= element;
      if (name === "DigestMethod") found.digestMethod ??= element;
      if (name === "X509Certificate") {
        const value = readText(element);
        if (isPresent(value) && value !== "") found.certificates.push(value);
      }
      if (name === "Signature") {
        const parent = element.parentElement;
        if (isPresent(parent)) {
          found.signedElements.push({
            element: parent.localName,
            id: readAttribute(parent, "ID"),
          });
        }
      }
    }

    if (
      inNamespaceOrUnprefixed(element, XML_ENCRYPTION_NS) &&
      name === "EncryptionMethod"
    ) {
      found.encryptionMethod ??= element;
    }
  }

  return found;
};

export const readMessageInfo = (document: Document): SamlMessageInfo => {
  const found = collect(document);
  const root = document.documentElement;

  return {
    kind: readMessageKind(root),
    id: readAttribute(root, "ID"),
    inResponseTo: readAttribute(root, "InResponseTo"),
    destination: readAttribute(root, "Destination"),
    issueInstant: readAttribute(root, "IssueInstant"),
    statusCode: readAttribute(found.statusCode, "Value"),
    issuer: readText(found.issuer),
    conditionNotBefore: readAttribute(found.conditions, "NotBefore"),
    conditionNotAfter: readAttribute(found.conditions, "NotOnOrAfter"),
    subject: readText(found.nameId),
    subjectConfirmationNotBefore: readAttribute(
      found.confirmationData,
      "NotBefore",
    ),
    subjectConfirmationNotAfter: readAttribute(
      found.confirmationData,
      "NotOnOrAfter",
    ),
    signatureAlgorithm: readAttribute(found.signatureMethod, "Algorithm"),
    digestAlgorithm: readAttribute(found.digestMethod, "Algorithm"),
    encryptionMethod: readAttribute(found.encryptionMethod, "Algorithm"),
    certificates: found.certificates,
    assertionCount: found.assertions,
    encryptedAssertionCount: found.encryptedAssertions,
    signedElements: found.signedElements,
    hasDuplicateIds: new Set(found.ids).size !== found.ids.length,
  };
};
