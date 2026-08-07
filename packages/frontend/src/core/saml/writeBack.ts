import { encodeSamlParameter } from "./codec";
import { type Compression } from "./types";

import {
  isAbsent,
  type ParameterSource,
  readQueryString,
  splitHead,
} from "@/utils";

export type TransportTarget = {
  name: string;
  source: ParameterSource;
  compression: Compression;
};

type StaleDetachedSignature = { name: string; value: string };

export type WriteBackOutcome =
  | { kind: "Ok"; raw: string }
  | { kind: "Failed"; reason: "ParameterMissing" | "ReadOnly" }
  | {
      kind: "BlockedByDetachedSignature";
      stale: StaleDetachedSignature[];
    };

const DETACHED_REDIRECT_PARAMETERS = ["SigAlg", "Signature"] as const;

const replaceInPairs = (
  pairs: string,
  name: string,
  encoded: string,
): { text: string; wasReplaced: boolean } => {
  let wasReplaced = false;

  const text = pairs
    .split("&")
    .map((pair) => {
      const at = pair.indexOf("=");
      if (at === -1 || pair.slice(0, at) !== name) return pair;

      wasReplaced = true;
      return `${name}=${encoded}`;
    })
    .join("&");

  return { text, wasReplaced };
};

const readStaleDetachedSignature = (
  raw: string,
  target: TransportTarget,
): StaleDetachedSignature[] => {
  if (target.source !== "Query") return [];

  const query = readQueryString(raw);
  return DETACHED_REDIRECT_PARAMETERS.flatMap((name) => {
    const found = query
      .split("&")
      .find((pair) => pair.slice(0, pair.indexOf("=")) === name);
    return isAbsent(found)
      ? []
      : [{ name, value: found.slice(found.indexOf("=") + 1) }];
  });
};

export const buildRawWithSaml = (input: {
  raw: string;
  xml: string;
  target: TransportTarget;
  isReadOnly: boolean;
  isStrippingDetachedSignature: boolean;
}): WriteBackOutcome => {
  if (input.isReadOnly) return { kind: "Failed", reason: "ReadOnly" };

  const stale = readStaleDetachedSignature(input.raw, input.target);
  if (stale.length > 0 && !input.isStrippingDetachedSignature) {
    return { kind: "BlockedByDetachedSignature", stale };
  }

  const encoded = encodeSamlParameter(input.xml, input.target.compression);
  const { head, separator, body } = splitHead(input.raw);

  if (input.target.source === "Body") {
    const replaced = replaceInPairs(body, input.target.name, encoded);
    return replaced.wasReplaced
      ? { kind: "Ok", raw: `${head}${separator}${replaced.text}` }
      : { kind: "Failed", reason: "ParameterMissing" };
  }

  const [requestLine, ...headerLines] = head.split(/\r?\n/);
  if (isAbsent(requestLine)) {
    return { kind: "Failed", reason: "ParameterMissing" };
  }

  const at = requestLine.indexOf("?");
  if (at === -1) return { kind: "Failed", reason: "ParameterMissing" };

  const endOfTarget = requestLine.indexOf(" ", at);
  const query = requestLine.slice(
    at + 1,
    endOfTarget === -1 ? undefined : endOfTarget,
  );
  const tail = endOfTarget === -1 ? "" : requestLine.slice(endOfTarget);

  const replaced = replaceInPairs(query, input.target.name, encoded);
  if (!replaced.wasReplaced) {
    return { kind: "Failed", reason: "ParameterMissing" };
  }

  const kept = input.isStrippingDetachedSignature
    ? replaced.text
        .split("&")
        .filter(
          (pair) =>
            !DETACHED_REDIRECT_PARAMETERS.some(
              (name) => pair.slice(0, pair.indexOf("=")) === name,
            ),
        )
        .join("&")
    : replaced.text;

  const lineEnding = head.includes("\r\n") ? "\r\n" : "\n";
  const rebuilt = [
    `${requestLine.slice(0, at)}?${kept}${tail}`,
    ...headerLines,
  ].join(lineEnding);

  return { kind: "Ok", raw: `${rebuilt}${separator}${body}` };
};
