import { readSignatures } from "./verify";
import { serializeXml } from "./xml";

import { isAbsent, type Maybe } from "@/utils";

export type SignatureLocation = {
  index: number;
  coveredId: string;
  parentPath: string;
};

const readPath = (leaf: Element): string => {
  const steps: string[] = [];
  let current: Maybe<Element> = leaf;

  while (!isAbsent(current)) {
    const step: Element = current;
    const parent = step.parentElement;

    if (isAbsent(parent)) {
      steps.unshift(step.localName);
      break;
    }

    const sameName = Array.from(parent.children).filter(
      (child) => child.localName === step.localName,
    );
    steps.unshift(
      sameName.length > 1
        ? `${step.localName}[${String(sameName.indexOf(step) + 1)}]`
        : step.localName,
    );
    current = parent;
  }

  return steps.join("/");
};

export const readSignatureLocations = (
  document: Document,
): SignatureLocation[] =>
  readSignatures(document).map((signature, index) => {
    const parent = signature.parentElement;
    const reference = signature.getElementsByTagName("*");
    const uri = Array.from(reference)
      .find((element) => element.localName === "Reference")
      ?.getAttribute("URI");

    return {
      index,
      coveredId: isAbsent(uri) ? "" : uri.replace(/^#/, ""),
      parentPath: isAbsent(parent) ? "" : readPath(parent),
    };
  });

export const buildDocumentWithoutAnySignature = (
  document: Document,
): string => {
  const clone = document.cloneNode(true) as Document;

  for (const signature of readSignatures(clone)) {
    signature.parentElement?.removeChild(signature);
  }

  return serializeXml(clone);
};
