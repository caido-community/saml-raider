import { type SignatureAlgorithm } from "shared";

import { EXCLUSIVE_C14N_URI } from "./algorithms";
import { toCanonicalXml } from "./c14n";
import { readAllElements } from "./xml";

import { buildDigest, isAbsent, type Maybe } from "@/utils";

const ID_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set(["ID", "Id", "id"]);

export type ElementIdIndex = ReadonlyMap<string, Element[]>;

export type ElementLookup =
  | { kind: "Ok"; element: Element }
  | { kind: "Missing" }
  | { kind: "Ambiguous"; count: number };

export const buildElementIdIndex = (root: Node): ElementIdIndex => {
  const index = new Map<string, Element[]>();

  for (const element of readAllElements(root)) {
    for (const name of ID_ATTRIBUTE_NAMES) {
      const value = element.getAttribute(name);
      if (isAbsent(value) || value === "") continue;

      index.set(value, [...(index.get(value) ?? []), element]);
    }
  }

  return index;
};

export const readElementById = (
  index: ElementIdIndex,
  id: string,
): ElementLookup => {
  const matches = index.get(id) ?? [];
  const element = matches[0];

  if (matches.length > 1) return { kind: "Ambiguous", count: matches.length };
  if (isAbsent(element)) return { kind: "Missing" };
  return { kind: "Ok", element };
};

export const readReferenceId = (uri: string): Maybe<string> =>
  uri.startsWith("#") && uri.length > 1 ? uri.slice(1) : undefined;

export const buildReferenceDigest = async (options: {
  element: Element;
  omit: Maybe<Node>;
  algorithm: SignatureAlgorithm;
  inclusivePrefixes: ReadonlySet<string>;
}): Promise<string> => {
  const canonical = toCanonicalXml(options.element, {
    withComments: false,
    inclusivePrefixes: options.inclusivePrefixes,
    omit: options.omit,
  });

  return buildDigest(new TextEncoder().encode(canonical), options.algorithm);
};

export const readInclusivePrefixes = (
  transform: Element,
): ReadonlySet<string> => {
  const list = transform
    .getElementsByTagNameNS(EXCLUSIVE_C14N_URI, "InclusiveNamespaces")
    .item(0);
  if (isAbsent(list)) return new Set<string>();

  const value = list.getAttribute("PrefixList");
  if (isAbsent(value)) return new Set<string>();

  return new Set(
    value
      .split(/\s+/)
      .filter((prefix) => prefix !== "")
      .map((prefix) => (prefix === "#default" ? "" : prefix)),
  );
};
