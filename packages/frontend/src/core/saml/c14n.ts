import { isAbsent, type Maybe } from "@/utils";

const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

export type CanonicalOptions = {
  withComments: boolean;
  inclusivePrefixes: ReadonlySet<string>;
  omit?: Maybe<Node>;
};

type Rendered = ReadonlyMap<string, string>;

const escapeCanonicalText = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");

const escapeCanonicalAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");

const readDeclaredNamespace = (
  element: Element,
  prefix: string,
): Maybe<string> => {
  let current: Maybe<Element> = element;
  while (!isAbsent(current)) {
    const declaration =
      prefix === ""
        ? current.getAttributeNS(XMLNS_NS, "xmlns")
        : current.getAttributeNS(XMLNS_NS, prefix);
    if (!isAbsent(declaration)) return declaration;
    current = current.parentElement;
  }

  return element.lookupNamespaceURI(prefix === "" ? null : prefix) ?? undefined;
};

const readUtilizedPrefixes = (
  element: Element,
  inclusivePrefixes: ReadonlySet<string>,
): string[] => {
  const prefixes = new Set<string>([element.prefix ?? ""]);

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.namespaceURI === XMLNS_NS) continue;
    const prefix = attribute.prefix ?? "";
    if (prefix !== "") prefixes.add(prefix);
  }

  for (const prefix of inclusivePrefixes) prefixes.add(prefix);

  return [...prefixes];
};

const buildNamespaceOutput = (
  element: Element,
  rendered: Rendered,
  inclusivePrefixes: ReadonlySet<string>,
): { text: string; rendered: Rendered } => {
  const next = new Map(rendered);
  const emitted: Array<{ prefix: string; uri: string }> = [];

  for (const prefix of readUtilizedPrefixes(element, inclusivePrefixes)) {
    const declared = readDeclaredNamespace(element, prefix) ?? "";
    const inherited = rendered.get(prefix) ?? "";
    if (declared === inherited) continue;

    next.set(prefix, declared);
    emitted.push({ prefix, uri: declared });
  }

  const text = emitted
    .sort((left, right) => (left.prefix < right.prefix ? -1 : 1))
    .map(({ prefix, uri }) =>
      prefix === ""
        ? ` xmlns="${escapeCanonicalAttribute(uri)}"`
        : ` xmlns:${prefix}="${escapeCanonicalAttribute(uri)}"`,
    )
    .join("");

  return { text, rendered: next };
};

const compareAttributes = (left: Attr, right: Attr): number => {
  const leftNs = left.namespaceURI ?? "";
  const rightNs = right.namespaceURI ?? "";
  if (leftNs !== rightNs) return leftNs < rightNs ? -1 : 1;
  return left.localName < right.localName ? -1 : 1;
};

const buildAttributeOutput = (element: Element): string =>
  Array.from(element.attributes)
    .filter((attribute) => attribute.namespaceURI !== XMLNS_NS)
    .sort(compareAttributes)
    .map(
      (attribute) =>
        ` ${attribute.name}="${escapeCanonicalAttribute(attribute.value)}"`,
    )
    .join("");

type Step =
  | { kind: "Node"; node: Node; rendered: Rendered }
  | { kind: "Close"; name: string };

export const toCanonicalXml = (
  root: Node,
  options: CanonicalOptions,
): string => {
  const parts: string[] = [];
  const pending: Step[] = [
    { kind: "Node", node: root, rendered: new Map<string, string>() },
  ];

  while (pending.length > 0) {
    const step = pending.pop();
    if (isAbsent(step)) break;

    if (step.kind === "Close") {
      parts.push(`</${step.name}>`);
      continue;
    }

    const node = step.node;
    if (node === options.omit) continue;

    if (
      node.nodeType === Node.TEXT_NODE ||
      node.nodeType === Node.CDATA_SECTION_NODE
    ) {
      parts.push(escapeCanonicalText(node.nodeValue ?? ""));
      continue;
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      if (options.withComments) parts.push(`<!--${node.nodeValue ?? ""}-->`);
      continue;
    }

    if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      const instruction = node as ProcessingInstruction;
      const data = instruction.data === "" ? "" : ` ${instruction.data}`;
      parts.push(`<?${instruction.target}${data}?>`);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const element = node as Element;
    const namespaces = buildNamespaceOutput(
      element,
      step.rendered,
      options.inclusivePrefixes,
    );

    parts.push(
      `<${element.nodeName}${namespaces.text}${buildAttributeOutput(element)}>`,
    );
    pending.push({ kind: "Close", name: element.nodeName });

    const children = Array.from(element.childNodes);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (isAbsent(child)) continue;
      pending.push({
        kind: "Node",
        node: child,
        rendered: namespaces.rendered,
      });
    }
  }

  return parts.join("");
};
