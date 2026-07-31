const INDENT = "  ";

const MAX_INDENT_DEPTH = 64;

const escapeText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string): string =>
  escapeText(value).replace(/"/g, "&quot;");

const isElement = (node: Node): boolean => node.nodeType === Node.ELEMENT_NODE;

const isCharacterData = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE;

const writeCharacterData = (node: Node): string => {
  const data = node.textContent ?? "";

  return node.nodeType === Node.CDATA_SECTION_NODE
    ? `<![CDATA[${data}]]>`
    : escapeText(data);
};

const openingTag = (element: Element): string => {
  const attributes = Array.from(element.attributes)
    .map(
      (attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`,
    )
    .join("");

  return `<${element.nodeName}${attributes}>`;
};

type Step =
  | { kind: "Open"; element: Element; depth: number }
  | { kind: "Text"; node: Node; depth: number }
  | { kind: "Close"; name: string; depth: number };

const selfClosingTag = (element: Element): string => {
  const opening = openingTag(element);

  return `${opening.slice(0, opening.length - 1)}/>`;
};

export const prettyPrintForDisplay = (document: Document): string => {
  const lines: string[] = [];
  const pending: Step[] = [
    { kind: "Open", element: document.documentElement, depth: 0 },
  ];

  while (pending.length > 0) {
    const step = pending.pop();
    if (step === undefined) break;

    const padding = INDENT.repeat(Math.min(step.depth, MAX_INDENT_DEPTH));

    if (step.kind === "Close") {
      lines.push(`${padding}</${step.name}>`);
      continue;
    }

    if (step.kind === "Text") {
      const inner = writeCharacterData(step.node);
      if (inner.trim().length > 0) lines.push(`${padding}${inner}`);
      continue;
    }

    const { element, depth } = step;
    const children = Array.from(element.childNodes);

    if (children.length === 0) {
      lines.push(`${padding}${selfClosingTag(element)}`);
      continue;
    }

    if (children.every((child) => isCharacterData(child))) {
      const inner = children.map((child) => writeCharacterData(child)).join("");
      lines.push(
        `${padding}${openingTag(element)}${inner}</${element.nodeName}>`,
      );
      continue;
    }

    lines.push(`${padding}${openingTag(element)}`);
    pending.push({ kind: "Close", name: element.nodeName, depth });

    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child === undefined) continue;

      if (isElement(child)) {
        pending.push({
          kind: "Open",
          element: child as Element,
          depth: depth + 1,
        });
        continue;
      }

      if (isCharacterData(child)) {
        pending.push({ kind: "Text", node: child, depth: depth + 1 });
      }
    }
  }

  return lines.join("\n");
};
