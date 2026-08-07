import { type ParsedDocument } from "./types";

import { isPresent } from "@/utils";

export const readAllElements = (root: Node): Element[] => {
  const found: Element[] = [];
  const pending: Node[] = [root];

  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;

    if (node.nodeType === Node.ELEMENT_NODE) found.push(node as Element);

    const children = node.childNodes;
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (isPresent(child)) pending.push(child);
    }
  }

  return found;
};

export const findElements = (root: Node, localName: string): Element[] =>
  readAllElements(root).filter((element) => element.localName === localName);

export const parseXml = (xml: string): ParsedDocument => {
  const document = new DOMParser().parseFromString(xml, "text/xml");

  const doctype = document.doctype;
  if (isPresent(doctype)) {
    return { kind: "DoctypeRejected", name: doctype.name };
  }

  const failure = findElements(document, "parsererror")[0];
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
