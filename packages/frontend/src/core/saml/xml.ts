import { type ParsedDocument, type SamlMessageInfo } from "@/types";
import { isAbsent, isPresent, type Maybe } from "@/utils";

const collectElements = (root: Node): Element[] => {
  const found: Element[] = [];

  const visit = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) found.push(node as Element);
    for (const child of Array.from(node.childNodes)) visit(child);
  };

  visit(root);
  return found;
};

export const findElements = (root: Node, localName: string): Element[] =>
  collectElements(root).filter((element) => element.localName === localName);

const findFirst = (root: Node, localName: string): Maybe<Element> =>
  findElements(root, localName)[0];

const readText = (root: Node, localName: string): Maybe<string> => {
  const element = findFirst(root, localName);
  if (isAbsent(element)) return undefined;

  return element.textContent?.trim();
};

const readAttribute = (
  root: Node,
  localName: string,
  attribute: string,
): Maybe<string> => {
  const element = findFirst(root, localName);
  if (isAbsent(element)) return undefined;

  return element.getAttribute(attribute) ?? undefined;
};

export const parseXml = (xml: string): ParsedDocument => {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  const failure = findFirst(document, "parsererror");

  if (isPresent(failure)) {
    return {
      kind: "Malformed",
      message: failure.textContent?.trim() ?? "Malformed XML",
    };
  }

  return { kind: "Ok", document };
};

export const serializeXml = (node: Node): string =>
  new XMLSerializer().serializeToString(node);

export const readMessageInfo = (document: Document): SamlMessageInfo => ({
  issuer: readText(document, "Issuer"),
  conditionNotBefore: readAttribute(document, "Conditions", "NotBefore"),
  conditionNotAfter: readAttribute(document, "Conditions", "NotOnOrAfter"),
  subject: readText(document, "NameID"),
  subjectConfirmationNotBefore: readAttribute(
    document,
    "SubjectConfirmationData",
    "NotBefore",
  ),
  subjectConfirmationNotAfter: readAttribute(
    document,
    "SubjectConfirmationData",
    "NotOnOrAfter",
  ),
  signatureAlgorithm: readAttribute(document, "SignatureMethod", "Algorithm"),
  digestAlgorithm: readAttribute(document, "DigestMethod", "Algorithm"),
  encryptionMethod: readAttribute(document, "EncryptionMethod", "Algorithm"),
  certificate: readText(document, "X509Certificate"),
});
