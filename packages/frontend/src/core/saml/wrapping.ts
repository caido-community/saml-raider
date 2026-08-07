import { SAML_ASSERTION_NS } from "./namespaces";
import {
  buildElementIdIndex,
  readElementById,
  readReferenceId,
} from "./reference";
import { readSignatures } from "./verify";
import { readAllElements } from "./xml";

import { isAbsent, type Maybe } from "@/utils";

export type WrappingRisk =
  | { kind: "None" }
  | { kind: "NoSignature" }
  | { kind: "DuplicateId"; id: string; count: number }
  | { kind: "UnresolvedReference"; id: Maybe<string> }
  | { kind: "SignedElementNotConsumed"; signedId: string; consumedId: string }
  | { kind: "SignedElementDetached"; signedId: string };

const isInsideSignature = (element: Element): boolean =>
  readSignatures(element.ownerDocument).some((signature) =>
    signature.contains(element),
  );

const readConsumedAssertion = (document: Document): Maybe<Element> =>
  Array.from(document.documentElement.children).find(
    (child) =>
      child.namespaceURI === SAML_ASSERTION_NS &&
      child.localName === "Assertion",
  );

export const readWrappingRisk = (document: Document): WrappingRisk => {
  const signature = readSignatures(document)[0];
  if (isAbsent(signature)) return { kind: "NoSignature" };

  const reference = readAllElements(signature).find(
    (element) => element.localName === "Reference",
  );
  const signedId = readReferenceId(reference?.getAttribute("URI") ?? "");
  if (isAbsent(signedId)) {
    return { kind: "UnresolvedReference", id: undefined };
  }

  const found = readElementById(buildElementIdIndex(document), signedId);
  if (found.kind === "Ambiguous") {
    return { kind: "DuplicateId", id: signedId, count: found.count };
  }
  if (found.kind === "Missing") {
    return { kind: "UnresolvedReference", id: signedId };
  }

  const signed = found.element;
  if (isInsideSignature(signed)) {
    return { kind: "SignedElementDetached", signedId };
  }

  if (signed.localName !== "Assertion") {
    return signed === document.documentElement
      ? { kind: "None" }
      : {
          kind: "SignedElementNotConsumed",
          signedId,
          consumedId: document.documentElement.getAttribute("ID") ?? "",
        };
  }

  const consumed = readConsumedAssertion(document);
  if (isAbsent(consumed)) return { kind: "SignedElementDetached", signedId };

  const consumedId = consumed.getAttribute("ID") ?? "";
  return consumed === signed
    ? { kind: "None" }
    : { kind: "SignedElementNotConsumed", signedId, consumedId };
};
