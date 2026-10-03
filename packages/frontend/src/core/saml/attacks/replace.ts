import { parseXml, serializeXml } from "../xml";

export type MatchMode =
  | "ExactTextNode"
  | "Substring"
  | "RegularExpression"
  | "AttributeValue";

export type ReplaceOutcome =
  | { kind: "Ok"; xml: string; matches: number; description: string }
  | { kind: "Refused"; reason: string };

export const MATCH_MODES: ReadonlyArray<{ value: MatchMode; label: string }> = [
  { value: "ExactTextNode", label: "Whole text node" },
  { value: "Substring", label: "Substring" },
  { value: "RegularExpression", label: "Regular expression" },
  { value: "AttributeValue", label: "Attribute value" },
];

const readPattern = (search: string): RegExp | string => {
  try {
    return new RegExp(search, "g");
  } catch {
    return "this is not a valid regular expression";
  }
};

const readTextNodes = (root: Node): Text[] => {
  const found: Text[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) found.push(child as Text);
      else walk(child);
    }
  };
  walk(root);
  return found;
};

const describe = (mode: MatchMode, matches: number, search: string): string => {
  const noun = matches === 1 ? "occurrence" : "occurrences";
  const where = mode === "AttributeValue" ? "attribute values" : "text";
  return `Replaced ${matches} ${noun} of "${search}" in ${where}.`;
};

const replaceAttributes = (
  clone: Document,
  search: string,
  replacement: string,
): number => {
  let matches = 0;
  for (const element of Array.from(clone.getElementsByTagName("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.value !== search) continue;
      attribute.value = replacement;
      matches += 1;
    }
  }
  return matches;
};

const replaceByPattern = (
  clone: Document,
  pattern: RegExp,
  replacement: string,
): number => {
  let matches = 0;
  for (const node of readTextNodes(clone)) {
    const found = node.data.match(pattern)?.length ?? 0;
    if (found === 0) continue;
    node.data = node.data.replace(pattern, replacement);
    matches += found;
  }
  return matches;
};

const replaceSubstring = (
  clone: Document,
  search: string,
  replacement: string,
): number => {
  let matches = 0;
  for (const node of readTextNodes(clone)) {
    const parts = node.data.split(search);
    if (parts.length === 1) continue;
    matches += parts.length - 1;
    node.data = parts.join(replacement);
  }
  return matches;
};

const replaceWholeTextNodes = (
  clone: Document,
  search: string,
  replacement: string,
): number => {
  let matches = 0;
  for (const node of readTextNodes(clone)) {
    if (node.data !== search) continue;
    node.data = replacement;
    matches += 1;
  }
  return matches;
};

export const applyMatchAndReplace = (
  document: Document,
  options: { mode: MatchMode; search: string; replacement: string },
): ReplaceOutcome => {
  if (options.search === "") {
    return { kind: "Refused", reason: "enter the text you want to replace" };
  }

  const clone = document.cloneNode(true) as Document;

  let matches = 0;
  switch (options.mode) {
    case "AttributeValue":
      matches = replaceAttributes(clone, options.search, options.replacement);
      break;

    case "RegularExpression": {
      const pattern = readPattern(options.search);
      if (typeof pattern === "string") {
        return { kind: "Refused", reason: pattern };
      }
      matches = replaceByPattern(clone, pattern, options.replacement);
      break;
    }

    case "Substring":
      matches = replaceSubstring(clone, options.search, options.replacement);
      break;

    case "ExactTextNode":
      matches = replaceWholeTextNodes(
        clone,
        options.search,
        options.replacement,
      );
      break;
  }

  const xml = serializeXml(clone);
  if (parseXml(xml).kind !== "Ok") {
    return {
      kind: "Refused",
      reason: "that replacement produced XML that no longer parses",
    };
  }

  return {
    kind: "Ok",
    xml,
    matches,
    description: describe(options.mode, matches, options.search),
  };
};
