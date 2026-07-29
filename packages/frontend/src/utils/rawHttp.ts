import { type Maybe } from "./optional";

export type ParameterSource = "Query" | "Body";

const splitHead = (raw: string): { head: string; body: string } => {
  const crlf = raw.indexOf("\r\n\r\n");
  if (crlf !== -1) {
    return { head: raw.slice(0, crlf), body: raw.slice(crlf + 4) };
  }

  const lf = raw.indexOf("\n\n");
  if (lf !== -1) {
    return { head: raw.slice(0, lf), body: raw.slice(lf + 2) };
  }

  return { head: raw, body: "" };
};

export const readHeader = (raw: string, name: string): Maybe<string> => {
  const wanted = name.toLowerCase();
  const lines = splitHead(raw).head.split(/\r?\n/).slice(1);

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim().toLowerCase() !== wanted) continue;
    return line.slice(separator + 1).trim();
  }

  return undefined;
};

export const readQueryString = (raw: string): string => {
  const requestLine = splitHead(raw).head.split(/\r?\n/)[0] ?? "";
  const target = requestLine.split(" ")[1] ?? "";
  const separator = target.indexOf("?");
  return separator === -1 ? "" : target.slice(separator + 1);
};

export const readBody = (raw: string): string => splitHead(raw).body;

export const readFormParameter = (
  raw: string,
  name: string,
  source: ParameterSource,
): Maybe<string> => {
  const encoded = source === "Query" ? readQueryString(raw) : readBody(raw);

  for (const pair of encoded.split("&")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== name) continue;
    return pair.slice(separator + 1);
  }

  return undefined;
};
