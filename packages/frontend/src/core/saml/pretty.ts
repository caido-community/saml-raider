import { isPresent, type Maybe } from "@/utils";

const INDENT = "  ";

const isClosingTag = (line: string): boolean => line.startsWith("</");

const isDeclaration = (line: string): boolean =>
  line.startsWith("<?") || line.startsWith("<!");

const isSelfClosingTag = (line: string): boolean => line.endsWith("/>");

const readTagName = (line: string): Maybe<string> =>
  /^<([\w.:-]+)/.exec(line)?.[1];

const hasMatchingCloseTag = (line: string): boolean => {
  const name = readTagName(line);
  return isPresent(name) && line.endsWith(`</${name}>`);
};

const isOpeningTag = (line: string): boolean =>
  !isClosingTag(line) &&
  !isDeclaration(line) &&
  !isSelfClosingTag(line) &&
  !hasMatchingCloseTag(line);

const toLines = (xml: string): string[] =>
  xml
    .replace(/>\s+</g, "><")
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export const prettyPrintForDisplay = (xml: string): string => {
  let depth = 0;

  return toLines(xml)
    .map((line) => {
      if (isClosingTag(line)) depth = Math.max(0, depth - 1);
      const indented = `${INDENT.repeat(depth)}${line}`;
      if (isOpeningTag(line)) depth += 1;
      return indented;
    })
    .join("\n");
};
